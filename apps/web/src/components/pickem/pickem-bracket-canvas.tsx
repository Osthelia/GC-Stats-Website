/**
 * GC-Stats - pickem-bracket-canvas
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ReactFlow, ReactFlowProvider, Background, Controls, type Node, type Edge } from "@xyflow/react";
import { PickemBracketMatchNode, PICKEM_BRACKET_MATCH_NODE_WIDTH, PICKEM_BRACKET_MATCH_NODE_HEIGHT, type PickemBracketMatchNodeData } from "@/components/pickem/pickem-bracket-match-node";
import { BracketElbowEdge } from "@/components/tournament/bracket-elbow-edge";
import { layoutBracket } from "@/lib/bracket-layout";
import { CONTROLS_DARK_STYLE } from "@/lib/bracket-controls-style";
import { GOLD, RED } from "@/lib/home-fake-data";
import type { VirtualMatch } from "@/lib/pickem/bracket-fill";
import { scoreBracketMatchPick, type PhaseScoringConfig } from "@/lib/pickem/scoring";
import type { EditorMatch, EditorEdge } from "@/lib/admin-bracket-editor-data";

const MIN_ZOOM = 0.1;
const COLUMN_WIDTH = 260;
const ROW_HEIGHT = 140;
const LANE_GAP = 50;

// Matches the same green used elsewhere on the tournament page
// (tournament-standings-table.tsx) — see tournament-bracket-canvas.tsx for
// why this must not be a stock Tailwind color.
const WINNER_EDGE_COLOR = "#3fb950";

const NODE_TYPES = { pickemBracketMatchNode: PickemBracketMatchNode };
const EDGE_TYPES = { bracketElbow: BracketElbowEdge };

/**
 * Pick'em's bracket canvas — same rendering pipeline as the public,
 * read-only `TournamentBracketCanvas` (React Flow + the shared
 * `layoutBracket` algorithm + `BracketElbowEdge`, same column/lane math so a
 * double/triple elimination stage draws identically here), just fed the
 * VIRTUAL bracket (`computeVirtualBracket`, predicted entrants) instead of
 * the real one, with each match's two sides clickable to predict a winner.
 */
export function PickemBracketCanvas({
  containers,
  matches,
  edges,
  virtual,
  entrantNames,
  selectedWinners,
  scoringConfig,
  disabled = false,
  onPick,
}: {
  containers: { id: number; name: string }[];
  matches: EditorMatch[];
  edges: EditorEdge[];
  virtual: Map<number, VirtualMatch>;
  entrantNames: Record<number, string>;
  selectedWinners: ReadonlyMap<number, number>;
  /** Scoring config of the currently viewed leaderboard scope — drives the points-at-stake/gain footer, purely a display concern (never affects which picks are valid). */
  scoringConfig: PhaseScoringConfig;
  disabled?: boolean;
  onPick: (matchId: number, entrantId: number) => void;
}) {
  const t = useTranslations("pickemPage");
  const tTournament = useTranslations("tournamentPage");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerNameById = useMemo(() => new Map(containers.map((c) => [c.id, c.name])), [containers]);

  const { nodes, baseEdges, height } = useMemo(() => {
    const layoutMatches = matches.map((m) => ({ id: String(m.id), containerId: String(m.containerId), round: m.round, displayOrder: m.displayOrder }));
    const layoutEdges = edges.map((e) => ({ fromMatchId: String(e.fromMatchId), toMatchId: String(e.toMatchId), fromResult: e.fromResult }));
    const containerOrder = containers.map((c) => String(c.id));
    const layout = layoutBracket(layoutMatches, layoutEdges, containerOrder, { columnWidth: COLUMN_WIDTH, rowHeight: ROW_HEIGHT, laneGap: LANE_GAP });
    const matchLane = new Map(layoutMatches.map((m) => [m.id, layout.laneIndexByContainer.get(m.containerId)]));

    const maxPoints = (round: number) => scoringConfig.teamCorrectPoints + scoringConfig.outcomeCorrectPoints + scoringConfig.advancementPerRoundPoints * round;
    const pointsSummaryTooltip = t("pointsSummaryTooltip");

    const nodes: Node<PickemBracketMatchNodeData>[] = matches.map((m) => {
      const vm = virtual.get(m.id);
      const pos = layout.positions.get(String(m.id)) ?? { x: 0, y: 0 };
      const selectedEntrantId = selectedWinners.get(m.id) ?? null;

      let earnedPoints = 0;
      if (m.winnerId !== null && selectedEntrantId !== null && vm) {
        const predictedOpponentId = vm.a.entrantId === selectedEntrantId ? vm.b.entrantId : vm.a.entrantId;
        earnedPoints = scoreBracketMatchPick({
          predictedWinnerId: selectedEntrantId,
          predictedOpponentId,
          round: m.round,
          actualEntrantAId: m.entrantAId,
          actualEntrantBId: m.entrantBId,
          actualWinnerId: m.winnerId,
          config: scoringConfig,
        });
      }

      return {
        id: String(m.id),
        type: "pickemBracketMatchNode",
        position: pos,
        width: PICKEM_BRACKET_MATCH_NODE_WIDTH,
        height: PICKEM_BRACKET_MATCH_NODE_HEIGHT,
        data: {
          containerName: containerNameById.get(m.containerId) ?? "",
          round: m.round,
          label: m.label,
          entrantAId: vm?.a.entrantId ?? null,
          entrantAName: vm?.a.entrantId !== null && vm?.a.entrantId !== undefined ? (entrantNames[vm.a.entrantId] ?? `#${vm.a.entrantId}`) : null,
          entrantBId: vm?.b.entrantId ?? null,
          entrantBName: vm?.b.entrantId !== null && vm?.b.entrantId !== undefined ? (entrantNames[vm.b.entrantId] ?? `#${vm.b.entrantId}`) : null,
          selectedEntrantId,
          tbdLabel: t("tbdLabel"),
          disabled,
          onPick: (entrantId: number) => onPick(m.id, entrantId),
          earnedPoints,
          maxPoints: maxPoints(m.round),
          pointsSummaryTooltip,
        } satisfies PickemBracketMatchNodeData,
        draggable: false,
        selectable: false,
      };
    });

    // A match nothing feeds out of (the bracket's final) — the cross-lane
    // connector into it always shows, hover or not (see
    // tournament-bracket-canvas.tsx for the full explanation).
    const nonTerminalMatchIds = new Set(layoutEdges.map((e) => e.fromMatchId));

    const baseEdges = edges.map((e) => {
      const sourceLane = matchLane.get(String(e.fromMatchId));
      const targetLane = matchLane.get(String(e.toMatchId));
      const crossLane = sourceLane !== targetLane;
      // Gutter sits just above the LOWER of the two lanes (bigger
      // index/offset), not just above the target — using the target
      // unconditionally breaks the upward direction (see
      // tournament-bracket-canvas.tsx for the full explanation).
      const lowerLane = sourceLane !== undefined && targetLane !== undefined ? Math.max(sourceLane, targetLane) : targetLane;
      const gutterY = crossLane && lowerLane !== undefined ? (layout.laneOffsetY.get(lowerLane) ?? 0) - LANE_GAP / 2 : undefined;
      return {
        id: `${e.fromMatchId}:${e.fromResult}->${e.toMatchId}:${e.toSlot}`,
        source: String(e.fromMatchId),
        target: String(e.toMatchId),
        sourceHandle: e.fromResult,
        targetHandle: e.toSlot,
        fromResult: e.fromResult,
        crossLane,
        alwaysVisible: !nonTerminalMatchIds.has(String(e.toMatchId)),
        gutterY,
      };
    });

    return { nodes, baseEdges, height: Math.max(360, layout.totalHeight) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, matches, edges, virtual, entrantNames, selectedWinners, scoringConfig, disabled, containerNameById, t]);

  const edges_: Edge[] = useMemo(
    () =>
      baseEdges.map((e) => {
        const touchesHovered = hoveredNodeId !== null && (e.source === hoveredNodeId || e.target === hoveredNodeId);
        const visible = !e.crossLane || e.alwaysVisible || touchesHovered;
        const stroke = touchesHovered ? (e.fromResult === "winner" ? WINNER_EDGE_COLOR : RED) : GOLD;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: "bracketElbow",
          data: { gutterY: e.gutterY },
          style: { stroke, strokeWidth: 1.5, opacity: visible ? 1 : 0, transition: "opacity 150ms, stroke 150ms" },
        };
      }),
    [baseEdges, hoveredNodeId]
  );

  if (nodes.length === 0) return null;

  return (
    <div className="gcs-flow-canvas relative overflow-hidden rounded-xl border border-neutral-800" style={{ background: "var(--gcs-surface-3)", height: `min(${height}px, 75vh)` }}>
      <style>{CONTROLS_DARK_STYLE}</style>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges_}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          panOnScroll
          zoomOnScroll={false}
          zoomActivationKeyCode="Control"
          panOnDrag
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={MIN_ZOOM}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#262626" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2" aria-hidden="true">
        <span className="rounded bg-black/40 px-2 py-1 text-[10px] font-bold tracking-widest text-neutral-400 uppercase backdrop-blur-sm">
          <kbd className="rounded bg-white/10 px-1 py-0.5">Ctrl</kbd> + {tTournament("zoomHint")}
        </span>
      </div>
    </div>
  );
}

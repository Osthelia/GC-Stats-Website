/**
 * GC-Stats - bracket-viewer-canvas
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, type Node, type Edge } from "@xyflow/react";
import { BracketViewerMatchNode, type BracketViewerMatchNodeData } from "@/components/admin/bracket-viewer/bracket-viewer-match-node";
import { BracketViewerElbowEdge } from "@/components/admin/bracket-viewer/bracket-viewer-elbow-edge";
import { layoutBracket } from "@/lib/bracket-layout";
import { CONTROLS_DARK_STYLE } from "@/lib/bracket-controls-style";
import type { PublicBracketMatch, PublicStageContainer } from "@/lib/tournament-bracket-data";

const COLUMN_WIDTH = 260;
const ROW_HEIGHT = 100;
const LANE_GAP = 50;

const NODE_TYPES = { bracketViewerMatchNode: BracketViewerMatchNode };
const EDGE_TYPES = { bracketViewerElbow: BracketViewerElbowEdge };

/**
 * Read-only admin rendering of a stage's bracket-shaped containers, for
 * `/admin/tournaments/{id}/bracket` — visually mirrors the public site's
 * TournamentBracketCanvas (same `layoutBracket` algorithm, cf. that lib
 * file's shared-use docstring, so both draw the exact same shape) but every
 * match node links into the admin match page instead of being purely
 * decorative. Kept as a separate component from the public canvas per
 * CLAUDE.md's admin/public split, even though the geometry is identical.
 *
 * Same cross-lane-hidden-until-hover behavior as the public canvas (see
 * that file's docstring) — only same-lane links show by default, hovering a
 * match reveals every link touching it.
 */
export function BracketViewerCanvas({ tournamentId, containers, tbdLabel }: { tournamentId: number; containers: PublicStageContainer[]; tbdLabel: string }) {
  const graphContainers = containers.filter((c) => c.graph);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const { nodes, baseEdges, height } = useMemo(() => {
    const layoutMatches = graphContainers.flatMap((c) => (c.graph?.matches ?? []).map((m) => ({ id: String(m.id), containerId: String(m.containerId), round: m.round, displayOrder: m.displayOrder })));
    const layoutEdges = graphContainers.flatMap((c) => (c.graph?.edges ?? []).map((e) => ({ fromMatchId: String(e.fromMatchId), toMatchId: String(e.toMatchId), fromResult: e.fromResult })));
    const containerOrder = graphContainers.map((c) => String(c.id));
    const layout = layoutBracket(layoutMatches, layoutEdges, containerOrder, { columnWidth: COLUMN_WIDTH, rowHeight: ROW_HEIGHT, laneGap: LANE_GAP });
    const matchLane = new Map(layoutMatches.map((m) => [m.id, layout.laneIndexByContainer.get(m.containerId)]));

    const nodes: Node<BracketViewerMatchNodeData>[] = graphContainers.flatMap((container) =>
      (container.graph?.matches ?? []).map((m: PublicBracketMatch) => {
        const winnerSide: "a" | "b" | null = m.winnerId === null ? null : m.winnerId === m.entrantAId ? "a" : m.winnerId === m.entrantBId ? "b" : null;
        const pos = layout.positions.get(String(m.id)) ?? { x: 0, y: 0 };

        return {
          id: String(m.id),
          type: "bracketViewerMatchNode",
          position: pos,
          data: {
            containerName: container.name,
            round: m.round,
            label: m.label,
            status: m.status,
            entrantAId: m.entrantAId,
            entrantAName: m.entrantAName,
            entrantBId: m.entrantBId,
            entrantBName: m.entrantBName,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            winnerSide,
            tbdLabel,
            matchHref: `/admin/tournaments/${tournamentId}/matches/${m.id}`,
          } satisfies BracketViewerMatchNodeData,
          draggable: false,
          selectable: false,
        };
      })
    );

    // A match nothing feeds out of (the bracket's final) — the cross-lane
    // connector into it always shows, hover or not (see
    // tournament-bracket-canvas.tsx for the full explanation).
    const nonTerminalMatchIds = new Set(layoutEdges.map((e) => e.fromMatchId));

    const baseEdges = graphContainers.flatMap((container) =>
      (container.graph?.edges ?? []).map((e) => {
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
      })
    );

    return { nodes, baseEdges, height: Math.max(360, layout.totalHeight) };
  }, [graphContainers, tbdLabel, tournamentId]);

  const edges: Edge[] = useMemo(
    () =>
      baseEdges.map((e) => {
        const touchesHovered = hoveredNodeId !== null && (e.source === hoveredNodeId || e.target === hoveredNodeId);
        const visible = !e.crossLane || e.alwaysVisible || touchesHovered;
        const stroke = touchesHovered ? (e.fromResult === "winner" ? "#4ade80" : "#f87171") : "#737373";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: "bracketViewerElbow",
          data: { gutterY: e.gutterY },
          style: { stroke, strokeWidth: 1.5, opacity: visible ? 1 : 0, transition: "opacity 150ms, stroke 150ms" },
        };
      }),
    [baseEdges, hoveredNodeId]
  );

  if (nodes.length === 0) return null;

  return (
    <div className="gcs-flow-canvas overflow-hidden rounded-md border" style={{ height }}>
      <style>{CONTROLS_DARK_STYLE}</style>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
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
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

/**
 * GC-Stats - tournament-bracket-canvas
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import {
  BracketMatchNode,
  BRACKET_MATCH_NODE_WIDTH,
  BRACKET_MATCH_NODE_HEIGHT,
  type BracketMatchNodeData,
} from "@/components/tournament/bracket-match-node";
import {
  BracketQualifierNode,
  BRACKET_QUALIFIER_NODE_WIDTH,
  BRACKET_QUALIFIER_NODE_HEIGHT,
  type BracketQualifierNodeData,
} from "@/components/tournament/bracket-qualifier-node";
import { BracketElbowEdge } from "@/components/tournament/bracket-elbow-edge";
import { layoutBracket } from "@/lib/bracket-layout";
import { CONTROLS_DARK_STYLE } from "@/lib/bracket-controls-style";
import { GOLD, RED } from "@/lib/home-fake-data";
import type {
  PublicBracketMatch,
  PublicStageContainer,
} from "@/lib/tournament-bracket-data";

// Same green used for a qualified/positive state elsewhere on the tournament
// page (tournament-standings-table.tsx) — the previous stock Tailwind
// green/red (#22c55e/#ef4444) didn't match the site's actual red
// (home-fake-data's RED, #f2555a), so a hovered loser edge looked like a
// different, off-brand red next to every other red on the page (explicit
// user report, 2026-09-17).
const WINNER_EDGE_COLOR = "#3fb950";

// Small enough that even a deep triple-elimination bracket (many columns,
// several merged lanes) can fully dezoom to fit the canvas on `fitView` —
// React Flow's own default (0.5) was cutting off large brackets, forcing a
// manual scroll/zoom-out just to see the whole thing (explicit user report).
const MIN_ZOOM = 0.1;

const COLUMN_WIDTH = 260;
const ROW_HEIGHT = 100;
const LANE_GAP = 50;

// Touch: zoom floor for the initial view, so match names stay readable.
const TOUCH_MIN_FIT_ZOOM = 0.55;

// Vertical gap between two qualifier slots hanging off the same match (its winner AND loser both advancing somewhere).
const QUALIFIER_GAP = 8;

const NODE_TYPES = { bracketMatchNode: BracketMatchNode, bracketQualifierNode: BracketQualifierNode };

/** Live match round, else the first round still waiting on a result, else the last round: where a phone user lands. */
function focusMatchIds(matches: PublicBracketMatch[]): string[] {
  if (matches.length === 0) return [];
  const live = matches.filter((m) => m.status === "live");
  if (live.length > 0) return live.map((m) => String(m.id));
  const pending = matches.filter(
    (m) =>
      m.status === "pending" && m.entrantAId !== null && m.entrantBId !== null,
  );
  const pool = pending.length > 0 ? pending : matches;
  const round =
    pending.length > 0
      ? Math.min(...pool.map((m) => m.round))
      : Math.max(...pool.map((m) => m.round));
  return pool.filter((m) => m.round === round).map((m) => String(m.id));
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return coarse;
}
const EDGE_TYPES = { bracketElbow: BracketElbowEdge };

/**
 * Public, read-only rendering of a stage's bracket-shaped containers —
 * reuses `@xyflow/react` (already adopted for the admin editor, cf.
 * bracket-engine-spec-v2.md's "an existing maintained library for complex
 * visuals" rule) with a purely public-styled node instead of the editable
 * admin one, per CLAUDE.md's dashboard/public-site component split.
 * Layout comes from the shared `layoutBracket` helper (lane-merging +
 * vertical centering — see that file's docstring), same one the admin
 * editor uses, so both render the same shape.
 *
 * Cross-lane connectors (e.g. an Upper-bracket loser dropping into Lower)
 * are hidden by default — only same-lane links (the straight-line flow of
 * a single bracket, GF's continuation of Upper included) show up front, to
 * keep a big double/triple-elim bracket from turning into a plate of
 * spaghetti. Hovering a match reveals every link touching it, in both
 * directions (2026-08-31, explicit user request).
 */
export function TournamentBracketCanvas({
  containers,
  tbdLabel,
}: {
  containers: PublicStageContainer[];
  tbdLabel: string;
}) {
  const t = useTranslations("tournamentPage");
  // Memoized so a hover re-render doesn't redo the whole layout below.
  const graphContainers = useMemo(() => containers.filter((c) => c.graph), [containers]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const touch = useCoarsePointer();
  // On touch, the canvas ignores gestures until tapped, so a vertical swipe still scrolls the page.
  const [exploring, setExploring] = useState(false);
  const interactive = !touch || exploring;

  const { nodes, baseEdges, focusIds, height } = useMemo(() => {
    const layoutMatches = graphContainers.flatMap((c) =>
      (c.graph?.matches ?? []).map((m) => ({
        id: String(m.id),
        containerId: String(m.containerId),
        round: m.round,
        displayOrder: m.displayOrder,
      })),
    );
    const layoutEdges = graphContainers.flatMap((c) =>
      (c.graph?.edges ?? []).map((e) => ({
        fromMatchId: String(e.fromMatchId),
        toMatchId: String(e.toMatchId),
        fromResult: e.fromResult,
      })),
    );
    const containerOrder = graphContainers.map((c) => String(c.id));
    const layout = layoutBracket(layoutMatches, layoutEdges, containerOrder, {
      columnWidth: COLUMN_WIDTH,
      rowHeight: ROW_HEIGHT,
      laneGap: LANE_GAP,
    });
    const matchLane = new Map(
      layoutMatches.map((m) => [
        m.id,
        layout.laneIndexByContainer.get(m.containerId),
      ]),
    );
    // A match nothing else feeds out of (the bracket's final, or a final
    // decider) — the cross-lane connector into it (e.g. Lower bracket
    // champion into the Grand Final) always shows, hover or not: it's the
    // one cross-lane link with nothing else nearby to declutter against,
    // so hiding it by default just makes the ending look disconnected
    // (explicit user report, 2026-09-21).
    const nonTerminalMatchIds = new Set(layoutEdges.map((e) => e.fromMatchId));

    const matchNodes: Node<BracketMatchNodeData>[] = graphContainers.flatMap(
      (container) =>
        (container.graph?.matches ?? []).map((m: PublicBracketMatch) => {
          const winnerSide: "a" | "b" | null =
            m.winnerId === null
              ? null
              : m.winnerId === m.entrantAId
                ? "a"
                : m.winnerId === m.entrantBId
                  ? "b"
                  : null;
          const pos = layout.positions.get(String(m.id)) ?? { x: 0, y: 0 };

          return {
            id: String(m.id),
            type: "bracketMatchNode",
            position: pos,
            width: BRACKET_MATCH_NODE_WIDTH,
            height: BRACKET_MATCH_NODE_HEIGHT,
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
              matchHref: `/match/${m.id}`,
            } satisfies BracketMatchNodeData,
            draggable: false,
            selectable: false,
          };
        }),
    );

    // V1's "Qualified" column: one slot per winner/loser advancing to
    // another container, in an extra column right after the last round of
    // the source match's own lane, level with that match.
    const laneMaxX = new Map<number | undefined, number>();
    for (const m of layoutMatches) {
      const lane = matchLane.get(m.id);
      const x = layout.positions.get(m.id)?.x ?? 0;
      laneMaxX.set(lane, Math.max(laneMaxX.get(lane) ?? 0, x));
    }
    const qualifiers = graphContainers.flatMap((c) => c.graph?.qualifiers ?? []);
    const qualifierNodes: Node<BracketQualifierNodeData>[] = qualifiers.map((q, i) => {
      const source = String(q.sourceMatchId);
      const siblings = qualifiers.filter((other) => other.sourceMatchId === q.sourceMatchId);
      const index = siblings.indexOf(q);
      const pos = layout.positions.get(source) ?? { x: 0, y: 0 };
      const offsetY = (index - (siblings.length - 1) / 2) * (BRACKET_QUALIFIER_NODE_HEIGHT + QUALIFIER_GAP);
      return {
        id: `qualifier-${i}`,
        type: "bracketQualifierNode",
        position: {
          x: (laneMaxX.get(matchLane.get(source)) ?? pos.x) + COLUMN_WIDTH,
          y: pos.y + (BRACKET_MATCH_NODE_HEIGHT - BRACKET_QUALIFIER_NODE_HEIGHT) / 2 + offsetY,
        },
        width: BRACKET_QUALIFIER_NODE_WIDTH,
        height: BRACKET_QUALIFIER_NODE_HEIGHT,
        data: {
          entrantName: q.entrantName,
          tbdLabel,
          tooltip: q.entrantName
            ? t("qualifiedTooltip", { team: q.entrantName, destination: q.label })
            : q.outcome === "winner"
              ? t("qualifiedTooltipWinner", { destination: q.label })
              : t("qualifiedTooltipLoser", { destination: q.label }),
          href: q.url,
        } satisfies BracketQualifierNodeData,
        draggable: false,
        selectable: false,
      };
    });
    const nodes: Node<BracketMatchNodeData | BracketQualifierNodeData>[] = [...matchNodes, ...qualifierNodes];
    const qualifierEdges = qualifiers.map((q, i) => ({
      id: `${q.sourceMatchId}:${q.outcome}->qualifier-${i}`,
      source: String(q.sourceMatchId),
      target: `qualifier-${i}`,
      sourceHandle: q.outcome,
      targetHandle: "a",
      fromResult: q.outcome,
      crossLane: false,
      alwaysVisible: true,
      gutterY: undefined as number | undefined,
    }));

    const bracketEdges = graphContainers.flatMap((container) =>
      (container.graph?.edges ?? []).map((e) => {
        const sourceLane = matchLane.get(String(e.fromMatchId));
        const targetLane = matchLane.get(String(e.toMatchId));
        const crossLane = sourceLane !== targetLane;
        // A y strictly between two lanes' row bands, never inside either —
        // routes a cross-lane connector's long horizontal leg through
        // guaranteed-empty space instead of across a lane's row of
        // matches. Always "just above the LOWER of the two lanes" (the one
        // with the bigger index/offset), not just above the target — using
        // the target unconditionally broke the upward direction (e.g. a
        // Lower bracket winner advancing into the Grand Final above it):
        // the gutter landed above the whole topmost lane instead of between
        // the two actual lanes, so the line shot up past its target then
        // doubled back down into it (explicit user report, 2026-09-17).
        const lowerLane =
          sourceLane !== undefined && targetLane !== undefined
            ? Math.max(sourceLane, targetLane)
            : targetLane;
        const gutterY =
          crossLane && lowerLane !== undefined
            ? (layout.laneOffsetY.get(lowerLane) ?? 0) - LANE_GAP / 2
            : undefined;
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
      }),
    );
    const baseEdges = [...bracketEdges, ...qualifierEdges];

    const focusIds = focusMatchIds(
      graphContainers.flatMap((c) => c.graph?.matches ?? []),
    );

    return {
      nodes,
      baseEdges,
      focusIds,
      height: Math.max(360, layout.totalHeight),
    };
  }, [graphContainers, tbdLabel, t]);

  // Default: a single gold color, no winner/loser distinction (both leave
  // the match from the same point, cf. BracketMatchNode) — only cross-lane
  // edges are hidden. Hovering a match distinguishes its own edges (green
  // winner / red loser) AND reveals its cross-lane ones.
  const edges: Edge[] = useMemo(
    () =>
      baseEdges.map((e) => {
        const touchesHovered =
          hoveredNodeId !== null &&
          (e.source === hoveredNodeId || e.target === hoveredNodeId);
        const visible = !e.crossLane || e.alwaysVisible || touchesHovered;
        const stroke = touchesHovered
          ? e.fromResult === "winner"
            ? WINNER_EDGE_COLOR
            : RED
          : GOLD;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: "bracketElbow",
          data: { gutterY: e.gutterY },
          style: {
            stroke,
            strokeWidth: 1.5,
            opacity: visible ? 1 : 0,
            transition: "opacity 150ms, stroke 150ms",
          },
        };
      }),
    [baseEdges, hoveredNodeId],
  );

  if (nodes.length === 0) return null;

  return (
    <div
      className="gcs-flow-canvas relative animate-in fade-in-0 overflow-hidden rounded-xl border border-neutral-800 duration-300"
      // Capped with a CSS min(), not left at the bracket's raw content
      // height: `fitView` dezooms to fit BOTH dimensions of whatever box
      // it's given, so a box already sized to the content's natural height
      // leaves it "dezoomed" only sideways — the bracket ends up a tiny
      // island in a mostly-empty tall box instead of filling the view
      // (explicit user report). Capping at a viewport fraction forces
      // fitView to shrink both axes together so the bracket actually fills
      // the box, however tall or wide it naturally is.
      style={{
        background: "var(--gcs-surface-3)",
        height: `min(${height}px, ${touch ? "55vh" : "75vh"})`,
      }}
    >
      <style>{CONTROLS_DARK_STYLE}</style>
      <ReactFlowProvider>
        <ReactFlow
          // Remount when the pointer type is known, fitView only runs on the first render.
          key={touch ? "touch" : "mouse"}
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          panOnScroll={!touch}
          zoomOnScroll={false}
          zoomOnPinch={interactive}
          zoomOnDoubleClick={interactive}
          zoomActivationKeyCode="Control"
          panOnDrag={interactive}
          preventScrolling={interactive}
          fitView
          fitViewOptions={
            touch
              ? {
                  padding: 0.15,
                  nodes: focusIds.map((id) => ({ id })),
                  minZoom: TOUCH_MIN_FIT_ZOOM,
                  maxZoom: 1,
                }
              : { padding: 0.08 }
          }
          minZoom={MIN_ZOOM}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#262626" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>

      {touch && !exploring && (
        <button
          type="button"
          onClick={() => setExploring(true)}
          className="absolute inset-x-0 bottom-0 z-10 flex h-full items-end justify-center bg-transparent pb-4"
        >
          <span className="rounded-lg bg-[#e4ae22] px-3.5 py-2 text-xs font-bold text-[#0e0e0e] shadow-lg transition-transform active:scale-95">
            {t("exploreBracket")}
          </span>
        </button>
      )}

      {touch && exploring && (
        <button
          type="button"
          onClick={() => setExploring(false)}
          className="absolute top-3 right-3 z-10 rounded-lg border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-transform active:scale-95"
        >
          {t("exploreBracketDone")}
        </button>
      )}

      {/* Same tip V1 showed under its pan/zoom bracket — Ctrl+wheel already
          zooms (`zoomActivationKeyCode`), plain wheel pans, but that's not
          discoverable on its own. */}
      {(!touch || exploring) && (
        <div
          className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2"
          aria-hidden="true"
        >
          <span className="rounded bg-black/40 px-2 py-1 text-[10px] font-bold tracking-widest whitespace-nowrap text-neutral-400 uppercase backdrop-blur-sm">
            {touch ? (
              t("zoomHintTouch")
            ) : (
              <>
                {/* Nom de touche clavier, identique EN/FR, pas de t() */}
                <kbd className="rounded bg-white/10 px-1 py-0.5">
                  Ctrl
                </kbd> + {t("zoomHint")}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

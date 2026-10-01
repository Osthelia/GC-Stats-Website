/**
 * GC-Stats - bracket-match-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Link } from "@/i18n/navigation";
import { GOLD, RED, tint } from "@/lib/home-fake-data";
import { formatSideScore } from "@/lib/match-score-format";

export type BracketMatchNodeData = {
  containerName: string;
  round: number;
  label: string | null;
  status: "pending" | "live" | "completed";
  entrantAId: number | null;
  entrantAName: string | null;
  entrantBId: number | null;
  entrantBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerSide: "a" | "b" | null;
  tbdLabel: string;
  matchHref: string;
};

// Fixed pixel row heights (not left to natural text flow), used to size
// the rows below. Connection points (both target slots AND both source
// handles) all sit at the exact node vertical CENTER — not per-row — so
// that a same-lane chain (e.g. Upper Round N -> Upper Round N+1, or Upper
// Final -> Grand Final) draws as a perfectly straight line: the entry and
// exit anchors always coincide with the same y-center calculation the
// layout algorithm (`bracket-layout.ts`) uses to vertically center matches.
// Per-row entry points (30%/70%) looked "more informative" but any small
// mismatch between a row's pixel center and the layout's node-center math
// showed up as a visibly crooked line — a single shared anchor removes the
// discrepancy entirely, and which entrant is on which side is already
// clear from the row content itself.
const HEADER_HEIGHT = 24;
const ROW_HEIGHT = 32;
const NODE_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 2;
const CENTER_Y = NODE_HEIGHT / 2;

// Exported so the canvas can set explicit `width`/`height` on the node
// object itself (not just the rendered div's CSS) — React Flow only
// considers a node "measured" after an async ResizeObserver round-trip
// otherwise, and until then treats it as invisible. On this canvas nodes
// stay invisible mid-hover (edges array gets a new reference on every
// hover, `adoptUserNodes` re-checks `measured` each time) unless the size
// is known upfront. Same fix already applied to the admin editor's
// round-header-node, see SUIVI.md.
export const BRACKET_MATCH_NODE_WIDTH = 224;
export const BRACKET_MATCH_NODE_HEIGHT = NODE_HEIGHT;

function SideRow({
  entrantId,
  name,
  score,
  isWinner,
  isLoser,
  tbdLabel,
}: {
  entrantId: number | null;
  name: string | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  tbdLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5" style={{ height: ROW_HEIGHT }}>
      <span
        className="truncate text-[12.5px]"
        style={{ fontWeight: isWinner ? 700 : 500, color: isWinner ? GOLD : isLoser ? "var(--gcs-text-tertiary)" : "var(--gcs-text)" }}
      >
        {name ?? tbdLabel}
      </span>
      {score !== null && (
        <span className="font-mono text-[12.5px] tabular-nums" style={{ fontWeight: isWinner ? 800 : 500, color: isWinner ? GOLD : "var(--gcs-text-tertiary)" }}>
          {formatSideScore(score, entrantId)}
        </span>
      )}
    </div>
  );
}

export function BracketMatchNode({ data }: NodeProps & { data: BracketMatchNodeData }) {
  const live = data.status === "live";

  return (
    <Link
      href={data.matchHref}
      className="nodrag nopan block w-56 overflow-hidden rounded-lg border border-neutral-800 transition-colors duration-150 hover:border-[#e4ae22]/50 hover:shadow-lg"
      style={{ background: "var(--gcs-surface-3)" }}
    >
      <Handle type="target" position={Position.Left} id="a" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="target" position={Position.Left} id="b" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />

      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 bg-black/20 px-2.5" style={{ height: HEADER_HEIGHT }}>
        <span className="truncate text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">{data.label ?? `${data.containerName} · R${data.round}`}</span>
        {live && (
          <span className="flex items-center gap-1 rounded px-1.5 py-0.5" style={{ background: tint(RED, 0.18) }}>
            <span className="relative flex h-1 w-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: RED }} />
              <span className="relative inline-flex h-1 w-1 rounded-full" style={{ background: RED }} />
            </span>
          </span>
        )}
      </div>

      <div className="divide-y divide-neutral-800/70">
        <SideRow entrantId={data.entrantAId} name={data.entrantAName} score={data.scoreA} isWinner={data.winnerSide === "a"} isLoser={data.winnerSide === "b"} tbdLabel={data.tbdLabel} />
        <SideRow entrantId={data.entrantBId} name={data.entrantBName} score={data.scoreB} isWinner={data.winnerSide === "b"} isLoser={data.winnerSide === "a"} tbdLabel={data.tbdLabel} />
      </div>

      {/* Both outgoing edges (winner/loser) leave from the exact same point
          — a single visual exit, not two offset ones — colored on the edge
          itself (gold by default, green/red on hover), not by handle
          position. Two Handle elements only because React Flow needs a
          distinct id per edge endpoint. */}
      <Handle type="source" position={Position.Right} id="winner" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
    </Link>
  );
}

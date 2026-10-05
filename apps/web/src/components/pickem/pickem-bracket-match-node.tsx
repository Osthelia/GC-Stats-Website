/**
 * GC-Stats - pickem-bracket-match-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Check } from "lucide-react";
import { GOLD, tint } from "@/lib/theme-colors";

export type PickemBracketMatchNodeData = {
  containerName: string;
  round: number;
  label: string | null;
  entrantAId: number | null;
  entrantAName: string | null;
  entrantBId: number | null;
  entrantBName: string | null;
  selectedEntrantId: number | null;
  tbdLabel: string;
  disabled: boolean;
  onPick: (entrantId: number) => void;
  /** Points actually scored on this match so far (0 until the real result is known AND the user has a pick). */
  earnedPoints: number;
  /** Max points a correct pick on this match is worth under the currently viewed scoring scope (team + outcome + round bonus). */
  maxPoints: number;
  pointsSummaryTooltip: string;
};

// Same fixed row heights as the real bracket's node (bracket-match-node.tsx),
// plus a footer strip for the points-at-stake/gain summary.
const HEADER_HEIGHT = 24;
const ROW_HEIGHT = 32;
const FOOTER_HEIGHT = 20;
const NODE_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 2 + FOOTER_HEIGHT;
const CENTER_Y = HEADER_HEIGHT + ROW_HEIGHT; // handles stay aligned on the two pick rows, footer excluded

export const PICKEM_BRACKET_MATCH_NODE_WIDTH = 224;
export const PICKEM_BRACKET_MATCH_NODE_HEIGHT = NODE_HEIGHT;

function SideRow({
  entrantId,
  name,
  isSelected,
  isOtherSelected,
  tbdLabel,
  disabled,
  onPick,
}: {
  entrantId: number | null;
  name: string | null;
  isSelected: boolean;
  isOtherSelected: boolean;
  tbdLabel: string;
  disabled: boolean;
  onPick: (entrantId: number) => void;
}) {
  return (
    <button
      type="button"
      disabled={entrantId === null || disabled}
      onClick={() => entrantId !== null && onPick(entrantId)}
      className="nodrag nopan flex w-full items-center gap-1.5 px-2.5 text-left transition-colors duration-150 enabled:cursor-pointer enabled:hover:bg-white/[0.06] disabled:cursor-not-allowed"
      style={{ height: ROW_HEIGHT, background: isSelected ? tint(GOLD, 0.12) : "transparent" }}
    >
      <Check className="h-3 w-3 flex-none" style={{ opacity: isSelected ? 1 : 0, color: GOLD }} />
      <span
        className="truncate text-[12.5px]"
        style={{
          fontWeight: isSelected ? 700 : 500,
          fontStyle: entrantId === null ? "italic" : "normal",
          color: entrantId === null ? "var(--gcs-text-tertiary)" : isSelected ? GOLD : isOtherSelected ? "var(--gcs-text-tertiary)" : "var(--gcs-text)",
          opacity: entrantId === null ? 0.6 : 1,
        }}
      >
        {name ?? tbdLabel}
      </span>
    </button>
  );
}

/**
 * Pick'em's bracket node — same shape/handles as the public bracket's
 * read-only `BracketMatchNode`, but each side is a clickable button (predicts
 * a winner, checkmark + tinted row when selected) instead of a link to a
 * match page, TBD sides are visibly muted/italic (not yet resolvable), and a
 * footer shows "points earned / points at stake" for this match — earned
 * stays 0 until the real result is known.
 */
export function PickemBracketMatchNode({ data }: NodeProps & { data: PickemBracketMatchNodeData }) {
  return (
    <div className="w-56 overflow-hidden rounded-lg border border-neutral-800" style={{ background: "var(--gcs-surface-3)" }}>
      <Handle type="target" position={Position.Left} id="a" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="target" position={Position.Left} id="b" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />

      <div className="flex items-center border-b border-neutral-800 bg-black/20 px-2.5" style={{ height: HEADER_HEIGHT }}>
        <span className="truncate text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">{data.label ?? `${data.containerName} · R${data.round}`}</span>
      </div>

      <div className="divide-y divide-neutral-800/70">
        <SideRow entrantId={data.entrantAId} name={data.entrantAName} isSelected={data.selectedEntrantId === data.entrantAId} isOtherSelected={data.selectedEntrantId !== null && data.selectedEntrantId === data.entrantBId} tbdLabel={data.tbdLabel} disabled={data.disabled} onPick={data.onPick} />
        <SideRow entrantId={data.entrantBId} name={data.entrantBName} isSelected={data.selectedEntrantId === data.entrantBId} isOtherSelected={data.selectedEntrantId !== null && data.selectedEntrantId === data.entrantAId} tbdLabel={data.tbdLabel} disabled={data.disabled} onPick={data.onPick} />
      </div>

      <div className="flex items-center justify-center border-t border-neutral-800 bg-black/20 px-2.5" style={{ height: FOOTER_HEIGHT }}>
        <span className="flex items-center gap-1 text-[10px] font-mono font-bold tabular-nums" title={data.pointsSummaryTooltip}>
          <span style={{ color: data.earnedPoints > 0 ? "#3fb950" : "var(--gcs-text-tertiary)" }}>{data.earnedPoints}</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-500">{data.maxPoints}</span>
        </span>
      </div>

      <Handle type="source" position={Position.Right} id="winner" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
    </div>
  );
}

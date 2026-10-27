/**
 * GC-Stats - pickem-bracket-match-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Check, X } from "lucide-react";
import { GOLD, RED, tint } from "@/lib/theme-colors";
import { formatSideScore } from "@/lib/match-score-format";
import { PickOutcomeIcon, OUTCOME_COLORS, type PickOutcome } from "@/components/pickem/pick-outcome-icon";

/** Locked phase view of a match: the user's guess, checked against the real match. */
export type PickemLockedMatch = {
  realEntrantAId: number | null;
  realEntrantBId: number | null;
  realScoreA: number | null;
  realScoreB: number | null;
  realWinnerId: number | null;
  live: boolean;
  /** Entrants that can still play this match, null when it can't be narrowed yet. */
  reachable: ReadonlySet<number> | null;
  outcome: PickOutcome;
  invalidLabel: string;
  invalidBadge: string;
  unreachableBadge: string;
  unreachableTooltip: string;
};

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
  /** Set once the phase is locked, switches the node to its read-only guess vs result view. */
  locked: PickemLockedMatch | null;
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

/** One guessed side of a locked match, marked against the real match. */
function LockedSideRow({
  entrantId,
  name,
  isPicked,
  locked,
  invalid,
  tbdLabel,
}: {
  entrantId: number | null;
  name: string | null;
  isPicked: boolean;
  locked: PickemLockedMatch;
  invalid: boolean;
  tbdLabel: string;
}) {
  const isRealA = entrantId !== null && entrantId === locked.realEntrantAId;
  const isRealB = entrantId !== null && entrantId === locked.realEntrantBId;
  // Guessed here but can no longer play this match.
  const absent = isAbsent(entrantId, locked);
  const score = isRealA ? locked.realScoreA : isRealB ? locked.realScoreB : null;
  const lost = !absent && locked.realWinnerId !== null && entrantId !== locked.realWinnerId;
  const won = locked.realWinnerId !== null && entrantId === locked.realWinnerId;

  const color = name === null || absent || lost ? "var(--gcs-text-tertiary)" : isPicked ? (won ? OUTCOME_COLORS.correct : GOLD) : "var(--gcs-text)";

  return (
    <div className="flex items-center justify-between gap-2 px-2.5" style={{ height: ROW_HEIGHT, opacity: absent ? 0.55 : 1 }}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className="truncate text-[12.5px]"
          style={{
            fontWeight: isPicked ? 700 : 500,
            fontStyle: name === null || absent ? "italic" : "normal",
            textDecoration: isPicked && lost ? "line-through" : "none",
            color,
          }}
        >
          {name ?? tbdLabel}
        </span>
        {isPicked && <PickOutcomeIcon outcome={locked.outcome} className="h-3 w-3" />}
      </span>
      {isPicked && absent && !invalid && (
        <span className="flex-none rounded px-1 text-[9px] font-bold tracking-wider uppercase" style={{ color: RED, background: tint(RED, 0.14) }} title={locked.unreachableTooltip}>
          {locked.unreachableBadge}
        </span>
      )}
      {score !== null && (
        <span className="font-mono text-[12.5px] tabular-nums" style={{ fontWeight: won ? 800 : 500, color: won ? GOLD : "var(--gcs-text-tertiary)" }}>
          {formatSideScore(score, entrantId)}
        </span>
      )}
    </div>
  );
}

function LockedMatchNode({ data, locked }: { data: PickemBracketMatchNodeData; locked: PickemLockedMatch }) {
  // Neither guessed team can reach this match, so no point is possible here.
  const guessed = [data.entrantAId, data.entrantBId].filter((id): id is number => id !== null);
  const invalid = guessed.length > 0 && guessed.every((id) => isAbsent(id, locked));

  return (
    <div className="w-56 overflow-hidden rounded-lg border border-neutral-800" style={{ background: "var(--gcs-surface-3)", borderColor: locked.live ? RED : undefined }}>
      <Handle type="target" position={Position.Left} id="a" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="target" position={Position.Left} id="b" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />

      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 bg-black/20 px-2.5" style={{ height: HEADER_HEIGHT }}>
        <span className="truncate text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">{data.label ?? `${data.containerName} · R${data.round}`}</span>
        {locked.live && (
          <span className="relative flex h-2 w-2 flex-none">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: RED }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: RED }} />
          </span>
        )}
        {invalid && (
          <span className="flex flex-none items-center gap-0.5 rounded px-1 text-[9px] font-bold tracking-wider uppercase" style={{ color: RED, background: tint(RED, 0.16) }} title={locked.invalidLabel}>
            <X className="h-2.5 w-2.5" strokeWidth={3.5} />
            {locked.invalidBadge}
          </span>
        )}
      </div>

      <div className="divide-y divide-neutral-800/70">
        <LockedSideRow entrantId={data.entrantAId} name={data.entrantAName} isPicked={data.entrantAId !== null && data.selectedEntrantId === data.entrantAId} locked={locked} invalid={invalid} tbdLabel={data.tbdLabel} />
        <LockedSideRow entrantId={data.entrantBId} name={data.entrantBName} isPicked={data.entrantBId !== null && data.selectedEntrantId === data.entrantBId} locked={locked} invalid={invalid} tbdLabel={data.tbdLabel} />
      </div>

      <PointsFooter data={data} lost={invalid} />

      <Handle type="source" position={Position.Right} id="winner" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
    </div>
  );
}

function isAbsent(entrantId: number | null, locked: PickemLockedMatch): boolean {
  return entrantId !== null && locked.reachable !== null && !locked.reachable.has(entrantId);
}

/** `lost`: no point can be earned on this match anymore, shown in red before the result. */
function PointsFooter({ data, lost = false }: { data: PickemBracketMatchNodeData; lost?: boolean }) {
  return (
    <div className="flex items-center justify-center border-t border-neutral-800 bg-black/20 px-2.5" style={{ height: FOOTER_HEIGHT }}>
      <span className="flex items-center gap-1 text-[10px] font-mono font-bold tabular-nums" title={data.pointsSummaryTooltip}>
        <span style={{ color: lost ? RED : data.earnedPoints > 0 ? OUTCOME_COLORS.correct : "var(--gcs-text-tertiary)" }}>{data.earnedPoints}</span>
        <span className="text-neutral-600">/</span>
        <span className="text-neutral-500">{data.maxPoints}</span>
      </span>
    </div>
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
  if (data.locked) return <LockedMatchNode data={data} locked={data.locked} />;
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

      <PointsFooter data={data} />

      <Handle type="source" position={Position.Right} id="winner" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
    </div>
  );
}

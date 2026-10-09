/**
 * GC-Stats - bracket-viewer-match-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatSideScore } from "@/lib/match-score-format";
import { IMPORT_STATUS_CARD_CLASS } from "@/lib/liquipedia-import-status-types";
import { useBracketViewerMatchAction } from "@/components/admin/bracket-viewer/bracket-viewer-match-action";

export type BracketViewerMatchNodeData = {
  matchId: number;
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

// Same fixed-height row geometry as the public BracketMatchNode (see that
// file's docstring for why every connection anchor sits at the shared
// vertical center rather than per row) so this admin copy draws identical
// lines from the same layoutBracket() output.
const HEADER_HEIGHT = 24;
const ROW_HEIGHT = 32;
const NODE_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 2;
const CENTER_Y = NODE_HEIGHT / 2;

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
      <span className={cn("truncate text-[12.5px]", isWinner ? "font-bold text-green-500" : isLoser ? "text-muted-foreground" : "font-medium")}>{name ?? tbdLabel}</span>
      {score !== null && (
        <span className={cn("font-mono text-[12.5px] tabular-nums", isWinner ? "font-extrabold text-green-500" : "text-muted-foreground")}>{formatSideScore(score, entrantId)}</span>
      )}
    </div>
  );
}

/**
 * Read-only admin bracket viewer node — visually mirrors the public site's
 * BracketMatchNode (same fixed geometry, same handle layout) but the whole
 * card is a link into the admin match page, and it uses admin (shadcn)
 * tokens instead of the public site's CSS variables. Kept as a separate
 * component per CLAUDE.md's admin/public split (see bracket-viewer-canvas.tsx).
 */
export function BracketViewerMatchNode({ data }: NodeProps & { data: BracketViewerMatchNodeData }) {
  const live = data.status === "live";
  const action = useBracketViewerMatchAction();

  const content = (
    <>
      <Handle type="target" position={Position.Left} id="a" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="target" position={Position.Left} id="b" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />

      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2.5" style={{ height: HEADER_HEIGHT }}>
        <span className="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{data.label ?? `${data.containerName} · R${data.round}`}</span>
        {live && (
          <span className="flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5">
            <span className="relative flex h-1 w-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1 w-1 rounded-full bg-red-500" />
            </span>
          </span>
        )}
      </div>

      <div className="divide-y">
        <SideRow entrantId={data.entrantAId} name={data.entrantAName} score={data.scoreA} isWinner={data.winnerSide === "a"} isLoser={data.winnerSide === "b"} tbdLabel={data.tbdLabel} />
        <SideRow entrantId={data.entrantBId} name={data.entrantBName} score={data.scoreB} isWinner={data.winnerSide === "b"} isLoser={data.winnerSide === "a"} tbdLabel={data.tbdLabel} />
      </div>

      <Handle type="source" position={Position.Right} id="winner" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: CENTER_Y, background: "transparent", border: "none" }} />
    </>
  );

  const baseClass = "nodrag nopan block w-56 overflow-hidden rounded-lg border shadow-sm transition-colors active:scale-[0.98]";

  if (action) {
    const status = action.statuses[data.matchId] ?? "none";
    return (
      <button
        type="button"
        onClick={() => action.onSelect({ id: data.matchId, teamA: data.entrantAName, teamB: data.entrantBName })}
        className={cn(baseClass, "cursor-pointer text-left", IMPORT_STATUS_CARD_CLASS[status])}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={data.matchHref} className={cn(baseClass, "bg-card hover:border-primary/50")}>
      {content}
    </Link>
  );
}

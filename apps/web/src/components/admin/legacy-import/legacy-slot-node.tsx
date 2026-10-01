/**
 * GC-Stats - legacy-slot-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { SquarePenIcon, Trash2Icon, XIcon, MoveDownIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatSideScore } from "@/lib/match-score-format";

export type LegacySlotNodeData = {
  matchId: number;
  containerName: string;
  round: number;
  label: string | null;
  filled: boolean;
  slotALabel: string;
  slotBLabel: string;
  scoreA: number | null;
  scoreB: number | null;
  entrantAId: number | null;
  entrantBId: number | null;
  isPending: boolean;
  /** True while a pool card is selected and ready to be placed — used to highlight every empty slot as clickable. */
  dropArmed: boolean;
  matchHref: string | null;
  onSlotClick: (matchId: number) => void;
  onDeleteEmpty: (matchId: number) => void;
  onUnassign: (matchId: number) => void;
};

export function LegacySlotNode({ data }: NodeProps & { data: LegacySlotNodeData }) {
  const t = useTranslations("admin.tournaments.legacyImport");
  const tEditor = useTranslations("admin.tournaments.editor");

  const clickable = !data.filled && data.dropArmed && !data.isPending;

  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-card p-2 shadow-sm transition-colors",
        !data.filled && "border-dashed",
        clickable && "cursor-pointer border-primary bg-primary/5 hover:bg-primary/10",
        data.isPending && "opacity-60"
      )}
      onClick={() => clickable && data.onSlotClick(data.matchId)}
    >
      <Handle type="target" position={Position.Left} id="a" className="!size-3" style={{ top: "38%" }} />
      <Handle type="target" position={Position.Left} id="b" className="!size-3" style={{ top: "72%" }} />

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {data.containerName} · {tEditor("roundLabel", { round: data.round })}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {data.matchHref && (
            <Link href={data.matchHref} className="nodrag text-muted-foreground hover:text-foreground" title={tEditor("editMatchLink")} onClick={(e) => e.stopPropagation()}>
              <SquarePenIcon className="size-3.5" />
            </Link>
          )}
          {data.filled ? (
            <button
              type="button"
              className="nodrag cursor-pointer text-muted-foreground hover:text-destructive"
              title={t("unassignButton")}
              disabled={data.isPending}
              onClick={(e) => {
                e.stopPropagation();
                data.onUnassign(data.matchId);
              }}
            >
              <XIcon className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              className="nodrag cursor-pointer text-muted-foreground hover:text-destructive"
              title={t("deleteSlotButton")}
              disabled={data.isPending}
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteEmpty(data.matchId);
              }}
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {data.label && <div className="mb-1 truncate text-xs font-semibold">{data.label}</div>}

      {data.filled ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 truncate rounded bg-muted px-2 py-1 text-xs">
            <span className="truncate">{data.slotALabel}</span>
            <span className="shrink-0 font-mono">{formatSideScore(data.scoreA, data.entrantAId)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 truncate rounded bg-muted px-2 py-1 text-xs">
            <span className="truncate">{data.slotBLabel}</span>
            <span className="shrink-0 font-mono">{formatSideScore(data.scoreB, data.entrantBId)}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
          <MoveDownIcon className="size-3.5" />
          {data.dropArmed ? t("dropHintArmed") : t("dropHint")}
        </div>
      )}

      <Handle type="source" position={Position.Right} id="winner" style={{ top: "38%" }} className="!size-3 !bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: "72%" }} className="!size-3 !bg-rose-500" />
    </div>
  );
}

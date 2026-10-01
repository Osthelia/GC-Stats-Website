/**
 * GC-Stats - legacy-match-pool-card
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatSideScore } from "@/lib/match-score-format";
import type { EditorMatch } from "@/lib/admin-bracket-editor-data";

export function LegacyMatchPoolCard({
  match,
  slotALabel,
  slotBLabel,
  selected,
  disabled,
  onClick,
}: {
  match: EditorMatch;
  slotALabel: string;
  slotBLabel: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("admin.tournaments.legacyImport");
  const locale = useLocale();

  const dateLabel = match.scheduledAt ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(match.scheduledAt)) : null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1 rounded-md border bg-card p-2 text-left text-xs shadow-sm transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/60",
        selected && "border-primary bg-primary/10 ring-1 ring-primary"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{slotALabel}</span>
        <span className="shrink-0 font-mono text-muted-foreground">{formatSideScore(match.scoreA, match.entrantAId)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{slotBLabel}</span>
        <span className="shrink-0 font-mono text-muted-foreground">{formatSideScore(match.scoreB, match.entrantBId)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{selected ? t("selectedHint") : t(`status.${match.status}`)}</span>
        {dateLabel && <span>{dateLabel}</span>}
      </div>
    </button>
  );
}

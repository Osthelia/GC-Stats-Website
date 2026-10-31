/**
 * GC-Stats - pickem-group-match-list
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Check, Loader2, Lock } from "lucide-react";
import { GOLD, RED, tint } from "@/lib/theme-colors";
import { formatSideScore } from "@/lib/match-score-format";
import { FormattedDate } from "@/components/formatted-date";
import { PickOutcomeIcon, OUTCOME_COLORS, type PickOutcome } from "@/components/pickem/pick-outcome-icon";
import type { PickFormGroupContainer, PickFormGroupMatch } from "@/lib/pickem/pickem-data";

/**
 * Matches mode of a Swiss/round robin container: one winner pick per match,
 * by round. Each match locks on its own when it starts, Swiss rounds show up
 * as soon as their matchups are drawn.
 */
export function PickemGroupMatchList({
  container,
  matches,
  entrantNames,
  picks,
  savingMatchIds,
  pointsPerMatch,
  readOnly = false,
  onPick,
}: {
  container: PickFormGroupContainer;
  matches: PickFormGroupMatch[];
  entrantNames: Record<number, string>;
  picks: Record<number, number>;
  savingMatchIds: ReadonlySet<number>;
  pointsPerMatch: number;
  /** Locked phase: every match shows as locked, whatever its own status. */
  readOnly?: boolean;
  onPick: (matchId: number, entrantId: number | null) => void;
}) {
  const t = useTranslations("pickemPage");

  const rounds = new Map<number, PickFormGroupMatch[]>();
  for (const m of [...matches].sort((a, b) => a.round - b.round || (a.displayOrder ?? a.id) - (b.displayOrder ?? b.id))) {
    const list = rounds.get(m.round) ?? [];
    list.push(m);
    rounds.set(m.round, list);
  }
  const showNextRoundsHint = !readOnly && container.format === "swiss" && container.status !== "completed";

  return (
    <div className="flex flex-col gap-5">
      {!readOnly && <p className="text-sm text-muted-foreground">{t("groupMatchHint")}</p>}

      {[...rounds.entries()].map(([round, roundMatches]) => (
        <section key={round} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("roundLabel", { round })}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roundMatches.map((m) => (
              <GroupMatchCard key={m.id} match={readOnly ? { ...m, locked: true } : m} entrantNames={entrantNames} pickedId={picks[m.id] ?? null} saving={savingMatchIds.has(m.id)} pointsPerMatch={pointsPerMatch} onPick={onPick} />
            ))}
          </div>
        </section>
      ))}

      {rounds.size === 0 && <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("groupMatchNone")}</p>}
      {showNextRoundsHint && rounds.size > 0 && <p className="rounded-lg border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">{t("groupMatchNextRounds")}</p>}
    </div>
  );
}

function GroupMatchCard({
  match,
  entrantNames,
  pickedId,
  saving,
  pointsPerMatch,
  onPick,
}: {
  match: PickFormGroupMatch;
  entrantNames: Record<number, string>;
  pickedId: number | null;
  saving: boolean;
  pointsPerMatch: number;
  onPick: (matchId: number, entrantId: number | null) => void;
}) {
  const t = useTranslations("pickemPage");
  const live = match.status === "live";
  const outcome: PickOutcome = pickedId === null || match.winnerId === null ? "pending" : match.winnerId === pickedId ? "correct" : "wrong";
  const earned = outcome === "correct" ? pointsPerMatch : 0;

  const side = (entrantId: number | null, score: number | null) => {
    const isPicked = entrantId !== null && entrantId === pickedId;
    const won = match.winnerId !== null && entrantId === match.winnerId;
    const lost = match.winnerId !== null && !won;
    const name = entrantId !== null ? (entrantNames[entrantId] ?? `#${entrantId}`) : null;
    const color = name === null || lost ? "var(--gcs-text-tertiary)" : isPicked ? (won ? OUTCOME_COLORS.correct : GOLD) : "var(--gcs-text)";
    const content = (
      <>
        <Check className="h-3 w-3 flex-none" style={{ opacity: isPicked ? 1 : 0, color: GOLD }} />
        <span className="flex-1 truncate text-[12.5px]" style={{ fontWeight: isPicked ? 700 : 500, fontStyle: name === null ? "italic" : "normal", textDecoration: isPicked && lost ? "line-through" : "none", color }}>
          {name ?? t("tbdLabel")}
        </span>
        {isPicked && <PickOutcomeIcon outcome={outcome} className="h-3 w-3" />}
        {score !== null && match.status !== "pending" && (
          <span className="font-mono text-[12.5px] tabular-nums" style={{ fontWeight: won ? 800 : 500, color: won ? GOLD : "var(--gcs-text-tertiary)" }}>
            {formatSideScore(score, entrantId)}
          </span>
        )}
      </>
    );
    const style = { height: 32, background: isPicked && !match.locked ? tint(GOLD, 0.12) : "transparent" };

    if (match.locked || entrantId === null) {
      return (
        <div className="flex w-full items-center gap-1.5 px-2.5" style={style}>
          {content}
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={saving}
        aria-pressed={isPicked}
        // Clicking the picked team again removes the pick.
        onClick={() => onPick(match.id, isPicked ? null : entrantId)}
        className="flex w-full items-center gap-1.5 px-2.5 text-left transition-colors duration-150 enabled:cursor-pointer enabled:hover:bg-white/[0.06] enabled:active:bg-white/[0.1] disabled:cursor-wait"
        style={style}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800" style={{ background: "var(--gcs-surface-3)", borderColor: live ? RED : undefined }}>
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 bg-black/20 px-2.5" style={{ height: 24 }}>
        <span className="truncate text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
          {match.label ?? (match.scheduledAt ? <FormattedDate date={match.scheduledAt} mode="datetime" /> : t("roundLabel", { round: match.round }))}
        </span>
        {saving ? (
          <Loader2 className="h-3 w-3 flex-none animate-spin text-neutral-400" aria-label={t("saving")} />
        ) : live ? (
          <span className="relative flex h-2 w-2 flex-none">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: RED }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: RED }} />
          </span>
        ) : match.locked && match.status === "pending" ? (
          <span title={t("groupMatchLocked")} className="flex flex-none">
            <Lock className="h-3 w-3 text-neutral-500" aria-label={t("groupMatchLocked")} />
          </span>
        ) : null}
      </div>

      <div className="divide-y divide-neutral-800/70">
        {side(match.entrantAId, match.scoreA)}
        {side(match.entrantBId, match.scoreB)}
      </div>

      <div className="flex items-center justify-center border-t border-neutral-800 bg-black/20 px-2.5" style={{ height: 20 }}>
        <span className="flex items-center gap-1 font-mono text-[10px] font-bold tabular-nums" title={t("pointsSummaryTooltip")}>
          <span style={{ color: outcome === "wrong" ? RED : earned > 0 ? OUTCOME_COLORS.correct : "var(--gcs-text-tertiary)" }}>{earned}</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-500">{pointsPerMatch}</span>
        </span>
      </div>
    </div>
  );
}

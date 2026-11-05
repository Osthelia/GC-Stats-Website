/**
 * GC-Stats - liquipedia-group-matches
 *
 * Match list of a group container (Swiss, round-robin) on the Liquipedia
 * export page: a click on a row opens the match wikicode.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { useBracketMatchAction } from "@/components/tournament/bracket-match-action";
import { formatSideScore } from "@/lib/match-score-format";
import type { PublicBracketMatch } from "@/lib/tournament-bracket-data";
import { cn } from "@/lib/utils";

export function LiquipediaGroupMatches({ matches }: { matches: PublicBracketMatch[] }) {
  const t = useTranslations("tournamentPage");
  const action = useBracketMatchAction();
  const ordered = [...matches].sort((a, b) => a.round - b.round || (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id);

  if (ordered.length === 0) return <p className="rounded-lg border border-dashed border-neutral-800 px-3 py-6 text-center text-xs text-neutral-500">{t("containerNotStarted")}</p>;

  return (
    <ul className="flex flex-col gap-1.5">
      {ordered.map((match) => {
        const winnerSide = match.winnerId === null ? null : match.winnerId === match.entrantAId ? "a" : match.winnerId === match.entrantBId ? "b" : null;
        const hasScore = match.status !== "pending" && match.scoreA !== null && match.scoreB !== null;
        return (
          <li key={match.id}>
            <button
              type="button"
              onClick={() => action?.onSelect({ id: match.id, teamA: match.entrantAName, teamB: match.entrantBName })}
              className="grid w-full cursor-pointer grid-cols-[3.5rem_1fr_auto_1fr] items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2 text-left text-[13px] transition-colors hover:border-[#e4ae22]/50 active:scale-[0.99]"
              style={{ background: "var(--gcs-surface-3)" }}
            >
              <span className="font-mono text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">{match.label ?? `R${match.round}`}</span>
              <span className={cn("truncate text-right", winnerSide === "a" ? "font-bold text-[#e4ae22]" : "font-medium text-neutral-200")}>{match.entrantAName ?? t("tbd")}</span>
              <span className="font-mono text-xs text-neutral-400 tabular-nums">
                {hasScore ? `${formatSideScore(match.scoreA, match.entrantAId)} - ${formatSideScore(match.scoreB, match.entrantBId)}` : t("vs")}
              </span>
              <span className={cn("truncate", winnerSide === "b" ? "font-bold text-[#e4ae22]" : "font-medium text-neutral-200")}>{match.entrantBName ?? t("tbd")}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

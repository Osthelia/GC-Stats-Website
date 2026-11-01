/**
 * GC-Stats - match-league-games
 *
 * The games of a LoL series on the match page. An "All games" tab shows the scoreboard averaged over the series;
 * each game has its own tab with its scoreboard, objectives and draft. Its own tab bar, as the map pills belong to Valorant.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LeagueDraft } from "@/components/match/match-league-draft";
import { LeagueScoreboard } from "@/components/match/match-league-scoreboard";
import { MatchScoreboardHeader } from "@/components/match/match-scoreboard-header";
import { PILL_ACTIVE_CLASS, PILL_INACTIVE_CLASS } from "@/components/match/match-map-pills";
import { otherEntrantOf } from "@gc-stats/lol-stats-engine";
import { averageScoreRows, championIconMap, gameScoreRows } from "@/lib/league-scoreboard";
import type { LeagueSeries } from "@/lib/match-league-games";
import type { MatchSide } from "@/lib/match-page-data";


const ALL_GAMES = "all";

type Props = { series: LeagueSeries; a: MatchSide; b: MatchSide; teamAName: string; teamBName: string };

export function MatchLeagueGames({ series, a, b, teamAName, teamBName }: Props) {
  const t = useTranslations("matchPage");
  const { games, averages } = series;
  const played = games.filter((game) => game.isCompleted);
  const [activeId, setActiveId] = useState<number | typeof ALL_GAMES | null>(played.length > 1 ? ALL_GAMES : (played[0]?.id ?? null));

  const iconByChampion = useMemo(() => championIconMap(games), [games]);
  const teamName = (entrantId: number | null) => (entrantId === a.entrantId ? teamAName : entrantId === b.entrantId ? teamBName : null);
  const teamTag = (entrantId: number | null) => (entrantId === a.entrantId ? (a.shortName ?? teamAName) : entrantId === b.entrantId ? (b.shortName ?? teamBName) : null);
  const active = activeId === ALL_GAMES ? null : (games.find((g) => g.id === activeId) ?? null);

  if (games.length === 0) return <p className="py-10 text-center text-lg font-semibold text-neutral-500">{t("noGames")}</p>;

  return (
    <div>
      <div className="no-scrollbar mb-10 flex snap-x flex-nowrap gap-2.5 overflow-x-auto md:flex-wrap md:justify-center md:overflow-visible" role="tablist" aria-label={t("games")}>
        {played.length > 1 && (
          <button type="button" role="tab" aria-selected={activeId === ALL_GAMES} onClick={() => setActiveId(ALL_GAMES)} className={tabClass(activeId === ALL_GAMES)}>
            {t("allGames")}
          </button>
        )}
        {games.map((game) => {
          const isActive = game.id === activeId;
          const winner = teamTag(game.winnerEntrantId);
          const label = (
            <>
              {t("gameTab", { order: game.order })}
              {game.isForfeit && <span className="font-mono text-[9px] opacity-80">{t("forfeit")}</span>}
              {game.isCompleted && winner && (
                <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${isActive ? "bg-black/15" : "bg-black/30 group-hover:bg-black/50"}`}>{winner}</span>
              )}
            </>
          );

          if (!game.isCompleted) {
            return (
              <span key={game.id} role="tab" aria-disabled aria-selected={false} className={`${tabClass(false)} cursor-not-allowed opacity-40`}>
                {label}
              </span>
            );
          }
          return (
            <button key={game.id} type="button" role="tab" aria-selected={isActive} onClick={() => setActiveId(game.id)} className={tabClass(isActive)}>
              {label}
            </button>
          );
        })}
      </div>

      {activeId === ALL_GAMES ? (
        <div className="space-y-4">
          <LeagueScoreboard header={<MatchScoreboardHeader a={a} b={b} teamAName={teamAName} teamBName={teamBName} />} nameA={teamAName} nameB={teamBName} rowsA={averageScoreRows(averages, a.entrantId, iconByChampion)} rowsB={averageScoreRows(averages, b.entrantId, iconByChampion)} />
        </div>
      ) : active ? (
        <div className="space-y-12">
          {active.note && <p className="text-center text-sm text-neutral-400 italic">{active.note}</p>}


          {active.draft ? (
            <div>
              <p className="pb-2 pl-3 md:pl-6 text-base font-semibold">{t("draft")}</p>
              <LeagueDraft draft={active.draft} blueName={teamName(active.draft.blueEntrantId) ?? "–"} redName={teamName(otherEntrantOf(active.draft.blueEntrantId, a.entrantId, b.entrantId)) ?? "–"} />
            </div>
          ) : (
            <p className="text-center text-sm text-neutral-500">{t("draftNotSet")}</p>
          )}

          <LeagueScoreboard
            header={
              <MatchScoreboardHeader
                a={a}
                b={b}
                teamAName={teamAName}
                teamBName={teamBName}
                scores={{ a: String(active.scoreAfter.a), b: String(active.scoreAfter.b) }}
                winner={active.winnerEntrantId === a.entrantId ? "a" : active.winnerEntrantId === b.entrantId ? "b" : null}
              />
            }
            nameA={teamAName}
            nameB={teamBName}
            rowsA={gameScoreRows(active, a.entrantId)}
            rowsB={gameScoreRows(active, b.entrantId)}
            objectivesA={active.objectives.find((o) => o.entrantId === a.entrantId)}
            objectivesB={active.objectives.find((o) => o.entrantId === b.entrantId)}
            durationSeconds={active.durationSeconds}
          />
        </div>
      ) : (
        <p className="py-10 text-center text-lg font-semibold text-neutral-500">{t("notPlayedYet")}</p>
      )}
    </div>
  );
}

function tabClass(isActive: boolean): string {
  return `group flex shrink-0 snap-start items-center gap-2.5 rounded-full px-5 py-2.5 text-[10px] font-black tracking-widest uppercase transition-all duration-300 ease-out ${isActive ? PILL_ACTIVE_CLASS : PILL_INACTIVE_CLASS}`;
}
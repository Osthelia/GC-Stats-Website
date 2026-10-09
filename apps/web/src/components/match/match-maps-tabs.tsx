/**
 * GC-Stats - match-maps-tabs
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MatchMapPills } from "@/components/match/match-map-pills";
import { MatchRoundHistory } from "@/components/match/match-round-history";
import { MatchTeamStatsTable } from "@/components/match/match-team-stats-table";
import { MatchPerformanceEconomy } from "@/components/match/match-performance-economy";
import type { MatchMap, MatchMapPlayerRow, MatchSide, MatchPerformance, MatchEcoSummary, MatchRound } from "@/lib/match-page-data";

/** Aggregated ("All Maps") + per-map tabs. Clicking a map pill only swaps the content below, no page navigation (mirrors V1's Alpine.js tabs). */
export function MatchMapsTabs({
  maps,
  aggregated,
  aggregatedPerformance,
  aggregatedEco,
  roundsByMapId,
  performanceByMapId,
  ecoByMapId,
  a,
  b,
  teamAName,
  teamBName,
  bestOf,
}: {
  maps: MatchMap[];
  aggregated: { playersA: MatchMapPlayerRow[]; playersB: MatchMapPlayerRow[] };
  aggregatedPerformance: MatchPerformance;
  aggregatedEco: MatchEcoSummary;
  roundsByMapId: Record<number, MatchRound[]>;
  performanceByMapId: Record<number, MatchPerformance>;
  ecoByMapId: Record<number, MatchEcoSummary>;
  a: MatchSide;
  b: MatchSide;
  teamAName: string;
  teamBName: string;
  bestOf: number;
}) {
  const t = useTranslations("matchPage");
  const [activeMapId, setActiveMapId] = useState<number | null>(bestOf === 1 ? maps[0]?.id ?? null : null);

  const activeMap = activeMapId != null ? maps.find((m) => m.id === activeMapId) : null;

  return (
    <div>
      <MatchMapPills maps={maps} bestOf={bestOf} activeMapId={activeMapId} onSelect={setActiveMapId} />

      {activeMap == null ? (
        <div className="space-y-12">
          <MatchTeamStatsTable statsA={aggregated.playersA} statsB={aggregated.playersB} a={a} b={b} teamAName={teamAName} teamBName={teamBName} />
          <MatchPerformanceEconomy
            statsA={aggregated.playersA}
            statsB={aggregated.playersB}
            teamAName={teamAName}
            teamBName={teamBName}
            performance={aggregatedPerformance}
            ecoSummary={aggregatedEco}
          />
        </div>
      ) : activeMap.isCompleted && (activeMap.teamAScore !== null || activeMap.teamBScore !== null) ? (
        <div className="space-y-12">
          {activeMap.note && <p className="text-center text-sm text-neutral-400 italic">{activeMap.note}</p>}
          <MatchRoundHistory rounds={roundsByMapId[activeMap.id] ?? []} a={a} b={b} />
          <MatchTeamStatsTable statsA={activeMap.playersA} statsB={activeMap.playersB} a={a} b={b} teamAName={teamAName} teamBName={teamBName} />
          <MatchPerformanceEconomy
            statsA={activeMap.playersA}
            statsB={activeMap.playersB}
            teamAName={teamAName}
            teamBName={teamBName}
            performance={performanceByMapId[activeMap.id] ?? {}}
            // Always set: getMatchMapsStatsBatch initializes every completed map's id up front
            ecoSummary={ecoByMapId[activeMap.id]!}
          />
        </div>
      ) : (
        <p className="py-10 text-center text-lg font-semibold text-neutral-500">{t(activeMap.isCompleted ? "notPlayed" : "notPlayedYet")}</p>
      )}
    </div>
  );
}

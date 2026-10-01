/**
 * GC-Stats - match-maps
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { MatchMapsTabs } from "@/components/match/match-maps-tabs";
import type { MatchMap, MatchMapPlayerRow, MatchSide, MatchPerformance, MatchEcoSummary, MatchRound } from "@/lib/match-page-data";

export async function MatchMaps({
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
  const t = await getTranslations("matchPage");

  if (maps.length === 0) {
    return (
      <div>
        <p className="py-10 text-center text-lg font-semibold text-neutral-500">{t("noMaps")}</p>
      </div>
    );
  }

  return (
    <MatchMapsTabs
      maps={maps}
      aggregated={aggregated}
      aggregatedPerformance={aggregatedPerformance}
      aggregatedEco={aggregatedEco}
      roundsByMapId={roundsByMapId}
      performanceByMapId={performanceByMapId}
      ecoByMapId={ecoByMapId}
      a={a}
      b={b}
      teamAName={teamAName}
      teamBName={teamBName}
      bestOf={bestOf}
    />
  );
}

/**
 * GC-Stats - tournament-map-pool-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import type { TournamentMapInsight, TournamentMapPickRate } from "@/lib/tournament-maps-data";
import { PickRateList } from "@/components/tournament/pick-rate-list";
import { GOLD } from "@/lib/home-fake-data";

const INSIGHT_COLORS: Record<TournamentMapInsight["label"], string> = {
  mostPlayed: GOLD,
  leastPlayed: "#8a8a8f",
  bestAtk: "#f2555a",
  bestDef: "#4c8bf5",
};

/**
 * Top of the maps page: insight cards (most/least played, best ATK/DEF) on
 * the left, tournament-wide agent pick rate on the right — explicit user
 * request, 2026-09-12 ("le global agent pickrate va aller au dessus des
 * maps, les 4 cards à gauche, le pickrate à droite, en double col"). The
 * per-map times-played/ATK/DEF table that used to sit here was folded into
 * the map picker below instead (same session, earlier request).
 */
export async function TournamentMapPoolPanel({ insights, overallPickRates }: { insights: TournamentMapInsight[]; overallPickRates: TournamentMapPickRate[] }) {
  const t = await getTranslations("tournamentPage");

  if (insights.length === 0) return null;

  const insightLabels: Record<TournamentMapInsight["label"], string> = {
    mostPlayed: t("mapsInsightMostPlayed"),
    leastPlayed: t("mapsInsightLeastPlayed"),
    bestAtk: t("mapsInsightBestAtk"),
    bestDef: t("mapsInsightBestDef"),
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="flex flex-col gap-3 lg:col-span-1">
        {insights.map((insight) => (
          <div key={insight.label} className="flex items-center gap-2.5 rounded-lg border border-neutral-800 px-4 py-4" style={{ background: "var(--gcs-surface-2)" }}>
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: INSIGHT_COLORS[insight.label] }} />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase">{insightLabels[insight.label]}</div>
              <div className="truncate text-[13px] font-bold text-neutral-100">{insight.mapName}</div>
            </div>
            <div className="flex-none font-mono text-xs font-semibold" style={{ color: INSIGHT_COLORS[insight.label] }}>
              {insight.value}
            </div>
          </div>
        ))}
      </div>

      <div className="lg:col-span-3">
        <h3 className="mb-2.5 text-[11px] font-black tracking-[0.14em] text-neutral-400 uppercase">{t("mapsPickRatesOverallTitle")}</h3>
        <PickRateList rates={overallPickRates} emptyLabel={t("mapsPickRatesEmpty")} initialLimit={10} showMoreLabel={t("mapsPickRatesShowMore")} showLessLabel={t("mapsPickRatesShowLess")} />
      </div>
    </div>
  );
}

/**
 * GC-Stats - tournament-champion-insights
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import type { ChampionInsight } from "@gc-stats/lol-stats-engine";
import { LolIcon } from "@/components/match/lol-icon";
import { GOLD } from "@/lib/theme-colors";

const INSIGHT_COLORS: Record<ChampionInsight["label"], string> = {
  mostPicked: GOLD,
  mostBanned: "#f2555a",
  highestPresence: "#4c8bf5",
  highestWinRate: "#3ecf8e",
  highestKda: "#c084fc",
};

/** The most icons a card shows; further tied champions are a "+N" and stay in the name line and its tooltip. */
const STACKED_ICONS = 3;

/** The icons of the champions on a card, overlapping; each one ringed in the card colour so the edges stay apart. */
function ChampionStack({ names, iconUrls }: { names: string[]; iconUrls: Record<string, string | null> }) {
  const hidden = names.length - STACKED_ICONS;
  return (
    <div className="flex flex-none items-center">
      <div className="flex -space-x-3">
        {names.slice(0, STACKED_ICONS).map((name) => (
          <span key={name} className="block rounded-sm ring-2 ring-(--gcs-surface-2)">
            <LolIcon kind="champion" url={iconUrls[name] ?? null} name={name} size={36} />
          </span>
        ))}
      </div>
      {hidden > 0 && <span className="ml-1.5 font-mono text-[10px] font-semibold text-neutral-500">+{hidden}</span>}
    </div>
  );
}

/** Top of the champions page: one card per highlight, the Maps page's cards with the icons of the leading champions (several on a tie). */
export async function TournamentChampionInsights({ insights, iconUrls }: { insights: ChampionInsight[]; iconUrls: Record<string, string | null> }) {
  const t = await getTranslations("tournamentPage");
  if (insights.length === 0) return null;

  const labels: Record<ChampionInsight["label"], string> = {
    mostPicked: t("championsInsightMostPicked"),
    mostBanned: t("championsInsightMostBanned"),
    highestPresence: t("championsInsightHighestPresence"),
    highestWinRate: t("championsInsightHighestWinRate"),
    highestKda: t("championsInsightHighestKda"),
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {insights.map((insight) => (
        <div key={insight.label} className="flex items-center gap-2.5 rounded-lg border border-neutral-800 px-4 py-4" style={{ background: "var(--gcs-surface-2)" }}>
          <ChampionStack names={insight.championNames} iconUrls={iconUrls} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase">{labels[insight.label]}</div>
            <div className="truncate text-[13px] font-bold text-neutral-100" title={insight.championNames.join(", ")}>
              {insight.championNames.join(", ")}
            </div>
          </div>
          <div className="flex-none font-mono text-xs font-semibold" style={{ color: INSIGHT_COLORS[insight.label] }}>
            {insight.value}
          </div>
        </div>
      ))}
    </div>
  );
}

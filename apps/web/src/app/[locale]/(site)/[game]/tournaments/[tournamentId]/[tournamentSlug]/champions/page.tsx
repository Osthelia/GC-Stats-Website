/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { gameHasSeriesGames } from "@gc-stats/db/game";
import { buildChampionInsights } from "@gc-stats/lol-stats-engine";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import { getTournamentChampionStats } from "@/lib/tournament-page-data";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { TournamentChampionInsights } from "@/components/tournament/tournament-champion-insights";
import { TournamentChampionsTable } from "@/components/tournament/tournament-champions-table";
import { StatsFilterBar } from "@/components/stats/stats-filter-bar";
import { STAT_COLUMN_SETS } from "@/lib/stats-columns";
import { LEAGUE_ROLE_LABELS, LEAGUE_STATS_FILTER_PARAMS, leagueStatsFilters, parseStatsFilters, type StatsSearchParams } from "@/lib/stats-filters";
import { LEAGUE_ROLES } from "@gc-stats/lol-stats-engine";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";
import { gameFromParams } from "@/lib/game";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string; game: string }> }): Promise<Metadata> {
  const game = await gameFromParams(params);
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(game, locale, tournamentId, "tournamentPage.tabChampions");
}

export default async function TournamentChampionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; tournamentSlug: string; game: string }>;
  searchParams: Promise<StatsSearchParams>;
}) {
  const game = await gameFromParams(params);
  if (!gameHasSeriesGames(game)) notFound();
  const { tournamentId } = await params;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(game, id);
  if (!tournament) notFound();

  const basePath = `${tournament.id}/${slugify(tournament.name)}`;
  // The filter bar keeps the Valorant slot names: its `map` slot is the role. There is no champion filter here, so a
  // `?champion=` left from the stats page is dropped instead of being carried along by every filter link.
  const filters = { ...parseStatsFilters(await searchParams, LEAGUE_STATS_FILTER_PARAMS), agent: "" };

  const [{ rows, iconUrls }, t] = await Promise.all([getTournamentChampionStats(game, id, leagueStatsFilters(filters)), getTranslations("tournamentPage")]);
  const set = STAT_COLUMN_SETS.lolChampions;

  const columnLabels: Record<string, string> = {};
  for (const c of set.columns) columnLabels[c.key] = t(`statsColumns.${c.i18nKey}`);

  return (
    <div>
      <TournamentHeader game={game} tournament={tournament} basePath={basePath} activeTab="champions" />

      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <StatsFilterBar
          basePath={`/tournaments/${basePath}/champions`}
          filters={filters}
          params={LEAGUE_STATS_FILTER_PARAMS}
          mapOptions={LEAGUE_ROLES.map((role) => ({ value: role, label: LEAGUE_ROLE_LABELS[role] ?? role }))}
          labels={{
            periodLabel: t("statsFilterPeriod"),
            allTime: t("statsFilterAllTime"),
            last30: t("statsFilterLast30"),
            last60: t("statsFilterLast60"),
            agentLabel: t(set.labels.agentFilter),
            agentDefault: t(set.labels.agentFilterAll),
            mapLabel: t(set.labels.mapFilter),
            mapDefault: t(set.labels.mapFilterAll),
            startDate: t("statsFilterStartDate"),
            endDate: t("statsFilterEndDate"),
            submit: t("statsFilterSubmit"),
          }}
        />

        {filters.map && <p className="-mt-3 mb-6 text-xs text-neutral-500">{t("championsRoleBansNote")}</p>}

        <div className="flex flex-col gap-6">
          <TournamentChampionInsights insights={buildChampionInsights(rows)} iconUrls={iconUrls} />
          <TournamentChampionsTable
            storageKey="tournamentChampions"
            rows={rows}
            iconUrls={iconUrls}
            rolesLabel={t("championsRolesColumn")}
            columnLabels={columnLabels}
            weaponsGroupLabel={t("statsWeaponsGroup")}
            columnsButtonLabel={t("statsColumnsButton")}
            modeAvgLabel={t("statsModeAvg")}
            modeTotalLabel={t("statsModeTotal")}
            noDataLabel={t("championsEmpty")}
            identityColumnLabel={t("statsChampionColumn")}
            filterLabels={{
              button: t("statsColumnFilterButton"),
              title: t("statsColumnFilterTitle"),
              columnLabel: t("statsColumnFilterColumnLabel"),
              valueLabel: t("statsColumnFilterValueLabel"),
              valuePlaceholder: t("statsColumnFilterValuePlaceholder"),
              addAnother: t("statsColumnFilterAddAnother"),
              apply: t("statsColumnFilterApply"),
              clear: t("statsColumnFilterClear"),
            }}
            paginationLabels={{ previous: t("previous"), next: t("next"), pageOf: t.raw("pageOf") }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { gameHasSeriesGames, gameHasStats } from "@gc-stats/db/game";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import {
  tournamentStatsScope,
  getTournamentStatsFilterOptions,
  getTournamentStatsPlayerMeta,
  leagueStatsScope,
  getLeagueStatsFilterOptions,
  getLeagueStatsPlayerMeta,
} from "@/lib/tournament-page-data";
import { getPeopleHandles } from "@/lib/team-page-data";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { TournamentStatsTable, type TournamentStatsPlayer } from "@/components/tournament/tournament-stats-table";
import { StatsFilterBar } from "@/components/stats/stats-filter-bar";
import { aggregateLeaguePlayerStatsSql, aggregateMapPlayerStatsSql } from "@/lib/stats-aggregate-sql";
import { STAT_COLUMN_SETS, buildWeaponColumns, weaponNameFromColumnKey, type StatColumn } from "@/lib/stats-columns";
import {
  LEAGUE_ROLE_LABELS,
  LEAGUE_STATS_FILTER_PARAMS,
  VALORANT_STATS_FILTER_PARAMS,
  leagueStatsFilters,
  parseStatsFilters,
  type LeagueStatsFilters,
  type ParsedStatsFilters,
  type StatsSearchParams,
} from "@/lib/stats-filters";
import type { LeagueStatRow, StatRow } from "@/lib/stats-aggregate";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";
import { gameFromParams } from "@/lib/game";
import type { GameSlug } from "@gc-stats/db/game";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string; game: string }> }): Promise<Metadata> {
  const game = await gameFromParams(params);
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(game, locale, tournamentId, "tournamentPage.tabStats");
}

export default async function TournamentStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; tournamentSlug: string; game: string }>;
  searchParams: Promise<StatsSearchParams>;
}) {
  const game = await gameFromParams(params);
  if (!gameHasStats(game)) notFound();
  const { tournamentId } = await params;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(game, id);
  if (!tournament) notFound();

  const basePath = `${tournament.id}/${slugify(tournament.name)}`;

  const sp = await searchParams;
  const league = gameHasSeriesGames(game);
  // LoL links read `?champion=…&role=…`; the parsed filters keep the Valorant slot names for the filter bar.
  const filterParams = league ? LEAGUE_STATS_FILTER_PARAMS : VALORANT_STATS_FILTER_PARAMS;
  const filters = parseStatsFilters(sp, filterParams);

  const [stats, t] = await Promise.all([league ? loadLeagueStats(game, id, leagueStatsFilters(filters)) : loadValorantStats(game, id, filters), getTranslations("tournamentPage")]);
  const { players, agentOptions, mapOptions, weaponColumns } = stats;
  const set = STAT_COLUMN_SETS[stats.columnSet];

  const columnLabels: Record<string, string> = {};
  for (const c of set.columns) columnLabels[c.key] = t(`statsColumns.${c.i18nKey}`);
  for (const c of weaponColumns) columnLabels[c.key] = weaponNameFromColumnKey(c.key);

  // Everything but the rows and their column set, which go in together below so their types stay linked.
  const tableProps = {
    storageKey: "tournament",
    columnLabels,
    weaponsGroupLabel: t("statsWeaponsGroup"),
    columnsButtonLabel: t("statsColumnsButton"),
    modeAvgLabel: t("statsModeAvg"),
    modeTotalLabel: t("statsModeTotal"),
    noDataLabel: t("statsNoData"),
    identityColumnLabel: t("statsIdentityColumn"),
    players,
    agentLabel: t(set.labels.agentColumn),
    nationalityLabel: t("statsNationalityColumn"),
    teamLabel: t("statsTeamColumn"),
    filterLabels: {
      button: t("statsColumnFilterButton"),
      title: t("statsColumnFilterTitle"),
      columnLabel: t("statsColumnFilterColumnLabel"),
      valueLabel: t("statsColumnFilterValueLabel"),
      valuePlaceholder: t("statsColumnFilterValuePlaceholder"),
      addAnother: t("statsColumnFilterAddAnother"),
      apply: t("statsColumnFilterApply"),
      clear: t("statsColumnFilterClear"),
    },
    paginationLabels: { previous: t("previous"), next: t("next"), pageOf: t.raw("pageOf") },
  };

  return (
    <div>
      <TournamentHeader game={game} tournament={tournament} basePath={basePath} activeTab="stats" />

      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <StatsFilterBar
          basePath={`/tournaments/${basePath}/stats`}
          filters={filters}
          params={filterParams}
          agentOptions={agentOptions}
          mapOptions={mapOptions}
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

        {stats.columnSet === "lol" ? (
          <TournamentStatsTable {...tableProps} columnSet="lol" rows={stats.rows} />
        ) : (
          <TournamentStatsTable {...tableProps} columnSet="valorant" rows={stats.rows} />
        )}
      </div>
    </div>
  );
}

/** What both games share; the rows come with the key of their column set, so the two can't be mixed up. */
type TournamentStats = {
  players: Record<string, TournamentStatsPlayer>;
  agentOptions: { value: string; label: string }[];
  mapOptions: { value: string; label: string }[];
  /** The per weapon columns, which exist for Valorant only. */
  weaponColumns: StatColumn[];
} & ({ columnSet: "valorant"; rows: StatRow[] } | { columnSet: "lol"; rows: LeagueStatRow[] });

/** The player cells' data of either game: the picks (agents or champions) and the team come from that game's meta. */
type StatsPlayerMeta = {
  agents?: string[];
  champions?: TournamentStatsPlayer["champions"];
  teamId: number | null;
  teamName: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

async function statsPlayers(game: GameSlug, rows: { groupKey: string }[], playerMeta: Map<number, StatsPlayerMeta>): Promise<Record<string, TournamentStatsPlayer>> {
  const people = await getPeopleHandles(game, rows.map((r) => Number(r.groupKey)));
  const players: Record<string, TournamentStatsPlayer> = {};
  for (const row of rows) {
    const personId = Number(row.groupKey);
    const person = people.get(personId);
    const meta = playerMeta.get(personId);
    players[row.groupKey] = {
      personId: person?.id ?? null,
      handle: person?.handle ?? null,
      countryCode: person?.countryCode ?? null,
      secondaryCountryCode: person?.secondaryCountryCode ?? null,
      agents: meta?.agents ?? [],
      champions: meta?.champions ?? [],
      teamId: meta?.teamId ?? null,
      teamName: meta?.teamName ?? null,
      logoUrl: meta?.logoUrl ?? null,
      logoUrlLight: meta?.logoUrlLight ?? null,
    };
  }
  return players;
}

async function loadValorantStats(game: GameSlug, tournamentId: number, filters: ParsedStatsFilters): Promise<TournamentStats> {
  const scope = tournamentStatsScope(game, tournamentId, filters);
  const [rows, playerMeta, filterOptions] = await Promise.all([
    aggregateMapPlayerStatsSql(scope, "personId"),
    getTournamentStatsPlayerMeta(game, scope),
    getTournamentStatsFilterOptions(game, tournamentId),
  ]);
  return {
    columnSet: "valorant",
    rows,
    players: await statsPlayers(game, rows, playerMeta),
    agentOptions: filterOptions.agents.map((a) => ({ value: a, label: a })),
    mapOptions: filterOptions.maps.map((m) => ({ value: m, label: m })),
    weaponColumns: buildWeaponColumns(rows),
  };
}

async function loadLeagueStats(game: GameSlug, tournamentId: number, filters: LeagueStatsFilters): Promise<TournamentStats> {
  const scope = leagueStatsScope(game, tournamentId, filters);
  const [rows, playerMeta, filterOptions] = await Promise.all([
    aggregateLeaguePlayerStatsSql(game, scope),
    getLeagueStatsPlayerMeta(game, scope),
    getLeagueStatsFilterOptions(game, tournamentId),
  ]);
  return {
    columnSet: "lol",
    rows,
    players: await statsPlayers(game, rows, playerMeta),
    agentOptions: filterOptions.champions.map((c) => ({ value: c, label: c })),
    mapOptions: filterOptions.roles.map((role) => ({ value: role, label: LEAGUE_ROLE_LABELS[role] ?? role })),
    weaponColumns: [],
  };
}

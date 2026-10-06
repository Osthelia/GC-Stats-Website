/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";
import { tournamentStatsScope, getTournamentStatsFilterOptions, getTournamentStatsPlayerMeta } from "@/lib/tournament-page-data";
import { getPeopleHandles } from "@/lib/team-page-data";
import { TournamentHeader } from "@/components/tournament/tournament-header";
import { TournamentStatsTable, type TournamentStatsPlayer } from "@/components/tournament/tournament-stats-table";
import { StatsFilterBar } from "@/components/stats/stats-filter-bar";
import { aggregateMapPlayerStatsSql } from "@/lib/stats-aggregate-sql";
import { STAT_COLUMNS, buildWeaponColumns, weaponNameFromColumnKey } from "@/lib/stats-columns";
import { parseStatsFilters, type StatsSearchParams } from "@/lib/stats-filters";
import type { Metadata } from "next";
import { tournamentPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tournamentId: string }> }): Promise<Metadata> {
  const { locale, tournamentId } = await params;
  return tournamentPageMetadata(locale, tournamentId, "tournamentPage.tabStats");
}

export default async function TournamentStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; tournamentSlug: string }>;
  searchParams: Promise<StatsSearchParams>;
}) {
  const { tournamentId } = await params;
  const id = parseEntityId(tournamentId);
  if (id === null) notFound();

  const tournament = await getPublicTournamentHeader(id);
  if (!tournament) notFound();

  const basePath = `${tournament.id}/${slugify(tournament.name)}`;

  const sp = await searchParams;
  const filters = parseStatsFilters(sp);

  const scope = tournamentStatsScope(id, filters);
  const [rows, playerMeta, filterOptions, t] = await Promise.all([
    aggregateMapPlayerStatsSql(scope, "personId"),
    getTournamentStatsPlayerMeta(scope),
    getTournamentStatsFilterOptions(id),
    getTranslations("tournamentPage"),
  ]);
  const people = await getPeopleHandles(rows.map((r) => Number(r.groupKey)));

  const weaponColumns = buildWeaponColumns(rows);
  const columnLabels: Record<string, string> = {};
  for (const c of STAT_COLUMNS) columnLabels[c.key] = t(`statsColumns.${c.i18nKey}`);
  for (const c of weaponColumns) columnLabels[c.key] = weaponNameFromColumnKey(c.key);

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
      teamId: meta?.teamId ?? null,
      teamName: meta?.teamName ?? null,
      logoUrl: meta?.logoUrl ?? null,
      logoUrlLight: meta?.logoUrlLight ?? null,
    };
  }

  return (
    <div>
      <TournamentHeader tournament={tournament} basePath={basePath} activeTab="stats" />

      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <StatsFilterBar
          basePath={`/tournaments/${basePath}/stats`}
          filters={filters}
          agentOptions={filterOptions.agents.map((a) => ({ value: a, label: a }))}
          mapOptions={filterOptions.maps.map((m) => ({ value: m, label: m }))}
          labels={{
            periodLabel: t("statsFilterPeriod"),
            allTime: t("statsFilterAllTime"),
            last30: t("statsFilterLast30"),
            last60: t("statsFilterLast60"),
            agentLabel: t("statsFilterAgent"),
            agentDefault: t("statsFilterAgentAll"),
            mapLabel: t("statsFilterMap"),
            mapDefault: t("statsFilterMapAll"),
            startDate: t("statsFilterStartDate"),
            endDate: t("statsFilterEndDate"),
            submit: t("statsFilterSubmit"),
          }}
        />

        <TournamentStatsTable
          rows={rows}
          storageKey="tournament"
          columnLabels={columnLabels}
          weaponsGroupLabel={t("statsWeaponsGroup")}
          columnsButtonLabel={t("statsColumnsButton")}
          modeAvgLabel={t("statsModeAvg")}
          modeTotalLabel={t("statsModeTotal")}
          noDataLabel={t("statsNoData")}
          identityColumnLabel={t("statsIdentityColumn")}
          players={players}
          agentLabel={t("statsAgentColumn")}
          nationalityLabel={t("statsNationalityColumn")}
          teamLabel={t("statsTeamColumn")}
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
  );
}

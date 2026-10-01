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
import { getPlayerPageInfo, playerStatsScope, getPlayerStatsFilterOptions } from "@/lib/player-page-data";
import { StatsTable } from "@/components/stats/stats-table";
import { StatsFilterBar } from "@/components/stats/stats-filter-bar";
import { aggregateMapPlayerStatsSql } from "@/lib/stats-aggregate-sql";
import { STAT_COLUMNS, buildWeaponColumns, weaponNameFromColumnKey } from "@/lib/stats-columns";
import { parseStatsFilters, type StatsSearchParams } from "@/lib/stats-filters";

export default async function PlayerStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string; playerSlug: string }>;
  searchParams: Promise<StatsSearchParams>;
}) {
  const { playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const sp = await searchParams;
  const filters = parseStatsFilters(sp);

  const [player, rows, filterOptions, t] = await Promise.all([
    getPlayerPageInfo(id),
    aggregateMapPlayerStatsSql(playerStatsScope(id, filters), "agentName"),
    getPlayerStatsFilterOptions(id),
    getTranslations("playerPage"),
  ]);
  if (!player) notFound();
  const basePath = `${player.id}/${slugify(player.handle)}`;

  const weaponColumns = buildWeaponColumns(rows);
  const columnLabels: Record<string, string> = {};
  for (const c of STAT_COLUMNS) columnLabels[c.key] = t(`statsColumns.${c.i18nKey}`);
  for (const c of weaponColumns) columnLabels[c.key] = weaponNameFromColumnKey(c.key);

  const identities: Record<string, { agentIcon: string; label: React.ReactNode; searchValue: string }> = {};
  for (const row of rows) {
    identities[row.groupKey] = { agentIcon: row.groupKey, label: row.groupKey, searchValue: row.groupKey };
  }

  return (
    <div>
      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <StatsFilterBar
          basePath={`/player/${basePath}/stats`}
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

        <StatsTable
          rows={rows}
          storageKey="player"
          columnLabels={columnLabels}
          weaponsGroupLabel={t("statsWeaponsGroup")}
          columnsButtonLabel={t("statsColumnsButton")}
          modeAvgLabel={t("statsModeAvg")}
          modeTotalLabel={t("statsModeTotal")}
          noDataLabel={t("statsNoData")}
          identityColumnLabel={t("statsIdentityColumn")}
          identities={identities}
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

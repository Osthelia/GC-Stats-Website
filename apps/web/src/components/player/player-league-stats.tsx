/**
 * GC-Stats - player-league-stats
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { GameSlug } from "@gc-stats/db/game";
import { playerNotInGame } from "@/lib/person-games-data";
import { slugify } from "@/lib/entity-id";
import { getLeaguePlayerStatsFilterOptions, getPlayerPageInfo, leaguePlayerStatsScope } from "@/lib/player-page-data";
import { aggregateLeaguePlayerStatsSql } from "@/lib/stats-aggregate-sql";
import { getChampionIconLookup } from "@/lib/data-dragon-client";
import { STAT_COLUMN_SETS } from "@/lib/stats-columns";
import { LEAGUE_ROLE_OPTIONS, parseLeagueStatsFilters, type StatsSearchParams } from "@/lib/stats-filters";
import { StatsTable } from "@/components/stats/stats-table";
import { LeagueStatsFilterBar } from "@/components/stats/league-stats-filter-bar";
import { LolIcon } from "@/components/match/lol-icon";

/** The LoL player stats tab: one row per champion the player has played, with the filters of the LoL tournament pages. */
export async function PlayerLeagueStats({ game, personId, searchParams }: { game: GameSlug; personId: number; searchParams: StatsSearchParams }) {
  const filters = parseLeagueStatsFilters(searchParams);
  const set = STAT_COLUMN_SETS.lol;

  // The column and filter labels are the LoL ones of the tournament pages; the table's own labels are the player page's.
  const [player, rows, options, iconUrlOf, t, tLeague] = await Promise.all([
    getPlayerPageInfo(game, personId),
    aggregateLeaguePlayerStatsSql(game, leaguePlayerStatsScope(game, personId, filters), "championName"),
    getLeaguePlayerStatsFilterOptions(game, personId),
    getChampionIconLookup(),
    getTranslations("playerPage"),
    getTranslations("tournamentPage"),
  ]);
  if (!player) return playerNotInGame(game, personId);

  const columnLabels: Record<string, string> = {};
  for (const c of set.columns) columnLabels[c.key] = tLeague(`statsColumns.${c.i18nKey}`);

  const identities: Record<string, { icon: ReactNode; label: ReactNode; searchValue: string }> = {};
  for (const row of rows) {
    identities[row.groupKey] = { icon: <LolIcon kind="champion" url={iconUrlOf(row.groupKey)} name={row.groupKey} size={28} />, label: row.groupKey, searchValue: row.groupKey };
  }

  return (
    <div>
      <div className="mx-auto max-w-[1400px] px-6 py-7 pb-[70px]">
        <LeagueStatsFilterBar
          basePath={`/player/${player.id}/${slugify(player.handle)}/stats`}
          filters={filters}
          patch={{ label: tLeague("statsFilterPatch"), defaultLabel: tLeague("statsFilterPatchAll"), options: options.patches.map((p) => ({ value: p, label: p })) }}
          role={{ label: tLeague(set.labels.mapFilter), defaultLabel: tLeague(set.labels.mapFilterAll), options: LEAGUE_ROLE_OPTIONS }}
          champion={{
            label: tLeague(set.labels.agentFilter),
            defaultLabel: tLeague(set.labels.agentFilterAll),
            options: options.champions.map((c) => ({ value: c, label: c })),
            search: { placeholder: tLeague("statsFilterChampionSearch"), noResult: tLeague("statsFilterChampionNoResult") },
          }}
        />

        <StatsTable
          rows={rows}
          columnSet="lol"
          storageKey="player"
          columnLabels={columnLabels}
          weaponsGroupLabel={t("statsWeaponsGroup")}
          columnsButtonLabel={t("statsColumnsButton")}
          modeAvgLabel={t("statsModeAvg")}
          modeTotalLabel={t("statsModeTotal")}
          noDataLabel={t("statsNoData")}
          identityColumnLabel={tLeague("statsChampionColumn")}
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

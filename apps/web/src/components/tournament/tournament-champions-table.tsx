/**
 * GC-Stats - tournament-champions-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo } from "react";
import { StatsTable, type StatsExtraColumn, type StatsTableProps } from "@/components/stats/stats-table";
import { LolIcon } from "@/components/match/lol-icon";
import { LEAGUE_ROLE_LABELS } from "@/lib/stats-filters";

export function TournamentChampionsTable({
  iconUrls,
  rolesLabel,
  showRoles,
  ...tableProps
}: Omit<StatsTableProps<"lolChampions">, "columnSet" | "identities" | "extraColumns"> & {
  iconUrls: Record<string, string | null>;
  rolesLabel: string;
  showRoles: boolean;
}) {
  const { rows } = tableProps;
  const { identities, extraColumns } = useMemo(() => {
    const identities: StatsTableProps<"lolChampions">["identities"] = {};
    const roles: StatsExtraColumn = { key: "roles", label: rolesLabel, cells: {}, searchValues: {} };
    for (const row of rows) {
      identities[row.groupKey] = {
        icon: <LolIcon kind="champion" url={iconUrls[row.groupKey] ?? null} name={row.groupKey} size={28} />,
        label: row.groupKey,
        searchValue: row.groupKey,
      };
      const names = row.roles.map((role) => LEAGUE_ROLE_LABELS[role] ?? role).join(", ");
      roles.cells[row.groupKey] = names || "–";
      roles.searchValues![row.groupKey] = names;
    }
    return { identities, extraColumns: showRoles ? [roles] : [] };
  }, [rows, iconUrls, rolesLabel, showRoles]);

  return <StatsTable {...tableProps} columnSet="lolChampions" identities={identities} extraColumns={extraColumns} />;
}

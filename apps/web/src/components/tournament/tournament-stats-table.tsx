/**
 * GC-Stats - tournament-stats-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatsTable, type StatsExtraColumn, type StatsGrouping, type StatsRowGroup, type StatsTableProps } from "@/components/stats/stats-table";
import type { StatColumnSetKey } from "@/lib/stats-columns";
import { AgentIcon } from "@/components/match/agent-icon";
import { LolIcon } from "@/components/match/lol-icon";
import { TeamBadge } from "@/components/home/team-badge";
import { CountryBadge, hasCountryFlag } from "@/components/team/country-badge";
import { countryName } from "@/lib/countries";
import { slugify } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { AGENT_ROLE_BY_AGENT, type AgentRole } from "@/lib/valorant-agents";
import type { StatsGroupBy } from "@/lib/stats-filters";

export type TournamentStatsPlayer = {
  personId: number | null;
  handle: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  agents: string[];
  /** LoL: the champions played, the most played first. */
  champions: { name: string; iconUrl: string | null }[];
  teamId: number | null;
  teamName: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

const dash = "-";

/** Max Champions show */
const SHOWN_CHAMPIONS = 5;

/** Cells are built here from plain data, so the RSC payload carries one small object per row instead of prerendered nodes. */
export function TournamentStatsTable<K extends StatColumnSetKey>({
  groupBy,
  players,
  roleLabels,
  ungroupedLabel,
  agentLabel,
  nationalityLabel,
  teamLabel,
  agentOptions,
  ...tableProps
}: Omit<StatsTableProps<K>, "identities" | "extraColumns"> & {
  groupBy: StatsGroupBy;
  players: Record<string, TournamentStatsPlayer>;
  roleLabels: Record<AgentRole, string>;
  ungroupedLabel: string;
  agentLabel: string;
  nationalityLabel: string;
  teamLabel: string;
  agentOptions: string[];
}) {
  const { columnSet } = tableProps;
  const locale = useLocale() as AppLocale;

  const { identities, extraColumns } = useMemo(() => {
    const identities: StatsTableProps<K>["identities"] = {};

    const agent: StatsExtraColumn = { key: "agent", label: agentLabel, cells: {}, searchValues: {}, filterOptions: agentOptions.map((a) => ({ value: a, label: a })) };
    const nationality: StatsExtraColumn = { key: "nationality", label: nationalityLabel, cells: {}, searchValues: {}, sortValues: {} };
    const team: StatsExtraColumn = { key: "team", label: teamLabel, cells: {}, searchValues: {} };
    const countryCodes = new Set<string>();
    const teamNames = new Set<string>();

    for (const [key, p] of Object.entries(players)) {
      identities[key] = {
        initial: (p.handle ?? "?").charAt(0).toUpperCase(),
        label:
          p.personId !== null && p.handle ? (
            <Link href={`/player/${p.personId}/${slugify(p.handle)}`} className="hover:text-[#e4ae22]">
              {p.handle}
            </Link>
          ) : (
            "?"
          ),
        searchValue: p.handle ?? "",
      };

      if (columnSet === "valorant") {
        agent.cells[key] =
          p.agents.length > 0 ? (
            <div className="flex -space-x-2">
              {p.agents.map((a) => (
                <AgentIcon key={a} agent={a} size="h-6 w-6" rounded />
              ))}
            </div>
          ) : (
            dash
          );
        agent.searchValues![key] = p.agents.join(", ");
      } else if (columnSet === "lol") {
        agent.cells[key] =
          p.champions.length > 0 ? (
            <div className="flex items-center justify-center gap-1">
              <div className="flex -space-x-1.5">
                {p.champions.slice(0, SHOWN_CHAMPIONS).map((c) => (
                  <LolIcon key={c.name} kind="champion" url={c.iconUrl} name={c.name} size={24} />
                ))}
              </div>
              {p.champions.length > SHOWN_CHAMPIONS && <span className="text-[10px] text-neutral-500">+{p.champions.length - SHOWN_CHAMPIONS}</span>}
            </div>
          ) : (
            dash
          );
        agent.searchValues![key] = p.champions.map((c) => c.name).join(", ");
      }

      nationality.cells[key] = hasCountryFlag(p.countryCode) ? (
        <span className="inline-flex justify-center">
          <CountryBadge code={p.countryCode} secondaryCode={p.secondaryCountryCode} />
        </span>
      ) : (
        dash
      );
      nationality.searchValues![key] = p.countryCode ?? "";
      nationality.sortValues![key] = countryName(p.countryCode, locale) ?? "";
      if (p.countryCode && hasCountryFlag(p.countryCode)) countryCodes.add(p.countryCode);

      team.cells[key] = p.teamName ? (
        p.teamId ? (
          <Link href={`/team/${p.teamId}/${slugify(p.teamName)}`} className="flex min-w-0 items-center justify-center gap-1.5 hover:text-[#e4ae22]">
            <TeamBadge tag={p.teamName} logoUrl={p.logoUrl} logoUrlLight={p.logoUrlLight} size={18} />
            <span className="truncate">{p.teamName}</span>
          </Link>
        ) : (
          <span className="truncate">{p.teamName}</span>
        )
      ) : (
        dash
      );
      team.searchValues![key] = p.teamName ?? "";
      if (p.teamName) teamNames.add(p.teamName);
    }

    nationality.filterOptions = [...countryCodes]
      .map((code) => ({ value: code, label: countryName(code, locale) ?? code, icon: <CountryBadge code={code} /> }))
      .sort((a, b) => a.label.localeCompare(b.label));
    team.filterOptions = [...teamNames].sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n }));

    return { identities, extraColumns: [agent, nationality, team] };
  }, [players, columnSet, agentLabel, nationalityLabel, teamLabel, agentOptions, locale]);

  const grouping = useMemo<StatsGrouping | undefined>(() => {
    if (groupBy === "none") return undefined;
    const rowGroups: StatsGrouping["rowGroups"] = {};
    for (const [key, p] of Object.entries(players)) {
      const groups: StatsRowGroup[] = [];
      if (groupBy === "agent") {
        for (const a of p.agents) groups.push({ key: a, label: a, icon: <AgentIcon agent={a} size="h-5 w-5" rounded /> });
      } else if (groupBy === "role") {
        const roles = new Set(p.agents.map((a) => AGENT_ROLE_BY_AGENT[a]).filter((r): r is AgentRole => !!r));
        for (const r of roles) groups.push({ key: r, label: roleLabels[r] });
      } else if (groupBy === "team") {
        if (p.teamName) groups.push({ key: String(p.teamId ?? p.teamName), label: p.teamName, icon: <TeamBadge tag={p.teamName} logoUrl={p.logoUrl} logoUrlLight={p.logoUrlLight} size={18} /> });
      } else if (p.countryCode && hasCountryFlag(p.countryCode)) {
        groups.push({ key: p.countryCode, label: countryName(p.countryCode, locale) ?? p.countryCode, icon: <CountryBadge code={p.countryCode} /> });
      }
      rowGroups[key] = groups;
    }
    return { rowGroups, ungrouped: { key: "__ungrouped__", label: ungroupedLabel } };
  }, [groupBy, players, roleLabels, ungroupedLabel, locale]);

  return <StatsTable {...tableProps} identities={identities} extraColumns={extraColumns} grouping={grouping} />;
}

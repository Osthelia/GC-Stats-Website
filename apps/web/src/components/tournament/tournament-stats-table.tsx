/**
 * GC-Stats - tournament-stats-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, type ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { StatsTable, type StatsExtraColumn } from "@/components/stats/stats-table";
import { AgentIcon } from "@/components/match/agent-icon";
import { TeamBadge } from "@/components/home/team-badge";
import { CountryBadge, hasCountryFlag } from "@/components/team/country-badge";
import { slugify } from "@/lib/entity-id";

export type TournamentStatsPlayer = {
  personId: number | null;
  handle: string | null;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  agents: string[];
  teamId: number | null;
  teamName: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

/** Cells are built here from plain data, so the RSC payload carries one small object per player instead of prerendered nodes. */
export function TournamentStatsTable({
  players,
  agentLabel,
  nationalityLabel,
  teamLabel,
  ...tableProps
}: Omit<ComponentProps<typeof StatsTable>, "identities" | "extraColumns"> & {
  players: Record<string, TournamentStatsPlayer>;
  agentLabel: string;
  nationalityLabel: string;
  teamLabel: string;
}) {
  const { identities, extraColumns } = useMemo(() => {
    const identities: ComponentProps<typeof StatsTable>["identities"] = {};
    const agent: StatsExtraColumn = { key: "agent", label: agentLabel, cells: {}, searchValues: {} };
    const nationality: StatsExtraColumn = { key: "nationality", label: nationalityLabel, cells: {}, searchValues: {} };
    const team: StatsExtraColumn = { key: "team", label: teamLabel, cells: {}, searchValues: {} };

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

      agent.cells[key] =
        p.agents.length > 0 ? (
          <div className="flex -space-x-2">
            {p.agents.map((a) => (
              <AgentIcon key={a} agent={a} size="h-6 w-6" rounded />
            ))}
          </div>
        ) : (
          "–"
        );
      agent.searchValues![key] = p.agents.join(", ");

      nationality.cells[key] = hasCountryFlag(p.countryCode) ? (
        <span className="inline-flex justify-center">
          <CountryBadge code={p.countryCode} secondaryCode={p.secondaryCountryCode} />
        </span>
      ) : (
        "–"
      );
      nationality.searchValues![key] = p.countryCode ?? "";

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
        "–"
      );
      team.searchValues![key] = p.teamName ?? "";
    }

    return { identities, extraColumns: [agent, nationality, team] };
  }, [players, agentLabel, nationalityLabel, teamLabel]);

  return <StatsTable {...tableProps} identities={identities} extraColumns={extraColumns} />;
}

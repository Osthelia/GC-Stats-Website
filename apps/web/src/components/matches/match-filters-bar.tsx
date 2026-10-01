/**
 * GC-Stats - match-filters-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ListFilterDropdown } from "@/components/filters/list-filter-dropdown";
import type { EntityMatchesFilters, EntityMatchesFilterOptions } from "@/lib/entity-matches";

/**
 * Matches tab filters for a team/player page — tournament, opponent and
 * result, same `ListFilterDropdown` pattern as `TournamentMatchesFilterBar`
 * (the site's one list-filter component). Shared between team and player
 * pages since the filter set is identical for both.
 */
export function MatchFiltersBar({
  basePath,
  filters,
  options,
  labels,
}: {
  basePath: string;
  filters: EntityMatchesFilters;
  options: EntityMatchesFilterOptions;
  labels: {
    tournamentLabel: string;
    tournamentDefault: string;
    opponentLabel: string;
    opponentDefault: string;
    resultLabel: string;
    resultDefault: string;
    resultWin: string;
    resultLoss: string;
    resultDraw: string;
  };
}) {
  const buildHref = (overrides: Partial<Record<"tournament" | "opponent" | "result", string>>) => {
    const qs = new URLSearchParams();
    const next = {
      tournament: filters.tournamentId != null ? String(filters.tournamentId) : "",
      opponent: filters.opponentTeamId != null ? String(filters.opponentTeamId) : "",
      result: filters.result ?? "",
      ...overrides,
    };
    if (filters.status) qs.set("status", filters.status);
    if (next.tournament) qs.set("tournament", next.tournament);
    if (next.opponent) qs.set("opponent", next.opponent);
    if (next.result) qs.set("result", next.result);
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  const tournamentOptions = options.tournaments.map((t) => ({ value: String(t.id), label: t.name, href: buildHref({ tournament: String(t.id) }) }));
  const opponentOptions = options.opponents.map((o) => ({ value: String(o.id), label: o.name, href: buildHref({ opponent: String(o.id) }) }));
  const resultOptions = [
    { value: "win", label: labels.resultWin, href: buildHref({ result: "win" }) },
    { value: "loss", label: labels.resultLoss, href: buildHref({ result: "loss" }) },
    { value: "draw", label: labels.resultDraw, href: buildHref({ result: "draw" }) },
  ];

  const activeTournament = options.tournaments.find((t) => t.id === filters.tournamentId)?.name ?? null;
  const activeOpponent = options.opponents.find((o) => o.id === filters.opponentTeamId)?.name ?? null;
  const activeResult = filters.result === "win" ? labels.resultWin : filters.result === "loss" ? labels.resultLoss : filters.result === "draw" ? labels.resultDraw : null;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {tournamentOptions.length > 0 && (
        <ListFilterDropdown
          label={labels.tournamentLabel}
          defaultLabel={labels.tournamentDefault}
          defaultHref={buildHref({ tournament: "" })}
          activeLabel={activeTournament}
          options={tournamentOptions}
        />
      )}
      {opponentOptions.length > 0 && (
        <ListFilterDropdown
          label={labels.opponentLabel}
          defaultLabel={labels.opponentDefault}
          defaultHref={buildHref({ opponent: "" })}
          activeLabel={activeOpponent}
          options={opponentOptions}
        />
      )}
      <ListFilterDropdown label={labels.resultLabel} defaultLabel={labels.resultDefault} defaultHref={buildHref({ result: "" })} activeLabel={activeResult} options={resultOptions} />
    </div>
  );
}

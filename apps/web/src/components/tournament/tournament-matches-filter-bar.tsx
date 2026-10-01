/**
 * GC-Stats - tournament-matches-filter-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ListFilterDropdown } from "@/components/filters/list-filter-dropdown";
import type { TournamentMatchesFilterOptions, TournamentMatchesFilters } from "@/lib/tournament-page-data";

/**
 * Matches tab filters — V1 parity, kept deliberately simple (explicit user
 * request: "boutons simple comme la v1"): four independent dropdowns, each
 * pre-populated with this tournament's real known values (stages/rounds/
 * teams/maps actually played), not free text. Same `ListFilterDropdown`
 * pattern already used by `StatsFilterBar`'s agent/map pickers — the site's
 * one list-filter component, not a new one-off control.
 */
export function TournamentMatchesFilterBar({
  basePath,
  filters,
  options,
  labels,
}: {
  basePath: string;
  filters: TournamentMatchesFilters;
  options: TournamentMatchesFilterOptions;
  labels: {
    stageLabel: string;
    stageDefault: string;
    roundLabel: string;
    roundDefault: string;
    teamLabel: string;
    teamDefault: string;
    mapLabel: string;
    mapDefault: string;
  };
}) {
  const buildHref = (overrides: Partial<Record<"stage" | "round" | "team" | "map", string>>) => {
    const qs = new URLSearchParams();
    const next = {
      stage: filters.stageId != null ? String(filters.stageId) : "",
      round: filters.round ?? "",
      team: filters.teamId != null ? String(filters.teamId) : "",
      map: filters.map ?? "",
      ...overrides,
    };
    if (next.stage) qs.set("stage", next.stage);
    if (next.round) qs.set("round", next.round);
    if (next.team) qs.set("team", next.team);
    if (next.map) qs.set("map", next.map);
    if (filters.status) qs.set("status", filters.status);
    const s = qs.toString();
    return `/tournaments/${basePath}/matches${s ? `?${s}` : ""}`;
  };

  const stageOptions = options.stages.map((s) => ({ value: String(s.id), label: s.name, href: buildHref({ stage: String(s.id) }) }));
  const roundOptions = options.rounds.map((r) => ({ value: r, label: r, href: buildHref({ round: r }) }));
  const teamOptions = options.teams.map((t) => ({ value: String(t.id), label: t.name, href: buildHref({ team: String(t.id) }) }));
  const mapOptions = options.maps.map((m) => ({ value: m, label: m, href: buildHref({ map: m }) }));

  const activeStage = options.stages.find((s) => s.id === filters.stageId)?.name ?? null;
  const activeTeam = options.teams.find((t) => t.id === filters.teamId)?.name ?? null;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {stageOptions.length > 0 && (
        <ListFilterDropdown label={labels.stageLabel} defaultLabel={labels.stageDefault} defaultHref={buildHref({ stage: "" })} activeLabel={activeStage} options={stageOptions} />
      )}
      {roundOptions.length > 0 && (
        <ListFilterDropdown label={labels.roundLabel} defaultLabel={labels.roundDefault} defaultHref={buildHref({ round: "" })} activeLabel={filters.round ?? null} options={roundOptions} />
      )}
      {teamOptions.length > 0 && (
        <ListFilterDropdown label={labels.teamLabel} defaultLabel={labels.teamDefault} defaultHref={buildHref({ team: "" })} activeLabel={activeTeam} options={teamOptions} />
      )}
      {mapOptions.length > 0 && <ListFilterDropdown label={labels.mapLabel} defaultLabel={labels.mapDefault} defaultHref={buildHref({ map: "" })} activeLabel={filters.map ?? null} options={mapOptions} />}
    </div>
  );
}

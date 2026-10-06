/**
 * GC-Stats - tournament-matches-filter-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Link } from "@/i18n/navigation";
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
    teamSearch: string;
    teamNoResult: string;
    mapLabel: string;
    mapDefault: string;
    sortLabel: string;
    sortNewest: string;
    sortOldest: string;
  };
}) {
  const buildHref = (overrides: Partial<Record<"stage" | "round" | "team" | "map" | "sort", string>>) => {
    const qs = new URLSearchParams();
    const next = {
      stage: filters.stageId != null ? String(filters.stageId) : "",
      round: filters.round ?? "",
      team: filters.teamId != null ? String(filters.teamId) : "",
      map: filters.map ?? "",
      sort: filters.sort ?? "",
      ...overrides,
    };
    if (next.stage) qs.set("stage", next.stage);
    if (next.round) qs.set("round", next.round);
    if (next.team) qs.set("team", next.team);
    if (next.map) qs.set("map", next.map);
    if (next.sort) qs.set("sort", next.sort);
    if (filters.status) qs.set("status", filters.status);
    const s = qs.toString();
    return `/tournaments/${basePath}/matches${s ? `?${s}` : ""}`;
  };

  const stageOptions = options.stages.map((s) => ({ value: String(s.id), label: s.name, href: buildHref({ stage: String(s.id) }) }));
  const roundOptions = options.rounds.map((r) => ({ value: r, label: r, href: buildHref({ round: r }) }));
  const teamOptions = options.teams.map((t) => ({ value: String(t.id), label: t.name, href: buildHref({ team: String(t.id) }) }));
  const mapOptions = options.maps.map((m) => ({ value: m, label: m, href: buildHref({ map: m }) }));

  const isOldest = filters.sort === "oldest";

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
        <ListFilterDropdown label={labels.teamLabel} defaultLabel={labels.teamDefault} defaultHref={buildHref({ team: "" })} activeLabel={activeTeam} options={teamOptions} search={{ placeholder: labels.teamSearch, noResult: labels.teamNoResult }} />
      )}
      {mapOptions.length > 0 && <ListFilterDropdown label={labels.mapLabel} defaultLabel={labels.mapDefault} defaultHref={buildHref({ map: "" })} activeLabel={filters.map ?? null} options={mapOptions} />}
      <Link
        href={buildHref({ sort: isOldest ? "" : "oldest" })}
        aria-label={labels.sortLabel}
        className="ml-auto flex items-center gap-1.5 rounded-full border border-[#e4ae22]/30 bg-[#e4ae22]/10 px-3 py-1.5 text-[9px] font-black tracking-widest text-[#e4ae22] uppercase transition-all hover:bg-[#e4ae22]/20 active:scale-95"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`flex-none transition-transform ${isOldest ? "rotate-180" : ""}`}>
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
        {isOldest ? labels.sortOldest : labels.sortNewest}
      </Link>
    </div>
  );
}

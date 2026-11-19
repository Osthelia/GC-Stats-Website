/**
 * GC-Stats - league-stats-filter-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ListFilterDropdown } from "@/components/filters/list-filter-dropdown";
import type { LeagueStatsFilters } from "@/lib/stats-filters";

type Option = { value: string; label: string };
type Dropdown = { label: string; defaultLabel: string; options: Option[]; search?: { placeholder: string; noResult: string } };

/**
 * Server-rendered filter bar of the LoL tournament pages: single-select dropdowns for the patch, the role and, where the
 * page has one, the champion (which can be typed in, as the list is long). Every option is a link, so a change reloads the page at once.
 */
export function LeagueStatsFilterBar({
  basePath,
  filters,
  patch,
  role,
  champion,
}: {
  basePath: string;
  filters: LeagueStatsFilters;
  patch: Dropdown;
  role: Dropdown;
  champion?: Dropdown;
}) {
  const buildHref = (overrides: Partial<LeagueStatsFilters>) => {
    const next = { ...filters, ...overrides };
    const qs = new URLSearchParams();
    if (champion && next.champion) qs.set("champion", next.champion);
    if (next.role) qs.set("role", next.role);
    if (next.patch) qs.set("patch", next.patch);
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  const dropdown = (key: keyof LeagueStatsFilters, { label, defaultLabel, options, search }: Dropdown) => (
    <span key={key}>
      <ListFilterDropdown
        label={label}
        defaultLabel={defaultLabel}
        defaultHref={buildHref({ [key]: "" })}
        activeLabel={options.find((o) => o.value === filters[key])?.label ?? null}
        options={options.map((o) => ({ ...o, href: buildHref({ [key]: o.value }) }))}
        search={search}
      />
    </span>
  );

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-800 bg-(--gcs-surface) p-4 shadow-xl">
      {dropdown("patch", patch)}
      {dropdown("role", role)}
      {champion && dropdown("champion", champion)}
    </div>
  );
}

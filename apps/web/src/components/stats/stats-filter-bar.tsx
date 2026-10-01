/**
 * GC-Stats - stats-filter-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ListFilterDropdown } from "@/components/filters/list-filter-dropdown";
import { SegmentedTrack, SegmentedLink } from "@/components/stats/segmented";

export type StatsFilterState = {
  agent: string;
  map: string;
  days: string;
  startDate: string;
  endDate: string;
};

/**
 * Server-rendered filter bar for a stats table page — period pills + single-select
 * agent/map dropdowns (`ListFilterDropdown`, the site's one list-filter pattern,
 * reused instead of building a multi-select checklist like V1's) + a native date
 * range (CLAUDE.md's datetime exception to "no native controls").
 */
export function StatsFilterBar({
  basePath,
  filters,
  agentOptions,
  mapOptions,
  labels,
}: {
  basePath: string;
  filters: StatsFilterState;
  agentOptions?: { value: string; label: string }[];
  mapOptions: { value: string; label: string }[];
  labels: {
    periodLabel: string;
    allTime: string;
    last30: string;
    last60: string;
    agentLabel: string;
    agentDefault: string;
    mapLabel: string;
    mapDefault: string;
    startDate: string;
    endDate: string;
    submit: string;
  };
}) {
  const buildHref = (overrides: Partial<StatsFilterState>) => {
    const next = { ...filters, ...overrides };
    const qs = new URLSearchParams();
    if (next.agent) qs.set("agent", next.agent);
    if (next.map) qs.set("map", next.map);
    if (next.days && next.days !== "0") qs.set("days", next.days);
    if (next.startDate) qs.set("startDate", next.startDate);
    if (next.endDate) qs.set("endDate", next.endDate);
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };

  const agentLinkOptions = agentOptions?.map((o) => ({
    ...o,
    href: buildHref({ agent: o.value }),
  }));
  const mapLinkOptions = mapOptions.map((o) => ({
    ...o,
    href: buildHref({ map: o.value }),
  }));
  const agentActive =
    agentOptions?.find((o) => o.value === filters.agent)?.label ?? null;
  const mapActive =
    mapOptions.find((o) => o.value === filters.map)?.label ?? null;

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] p-4 shadow-xl lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <span className="mb-1.5 ml-1 block text-[9px] font-black tracking-[0.3em] text-neutral-600 uppercase">
          {labels.periodLabel}
        </span>
        <SegmentedTrack>
          <SegmentedLink
            href={buildHref({ days: "0", startDate: "", endDate: "" })}
            active={filters.days === "0" && !filters.startDate}
          >
            {labels.allTime}
          </SegmentedLink>
          <SegmentedLink
            href={buildHref({ days: "30", startDate: "", endDate: "" })}
            active={filters.days === "30" && !filters.startDate}
          >
            {labels.last30}
          </SegmentedLink>
          <SegmentedLink
            href={buildHref({ days: "60", startDate: "", endDate: "" })}
            active={filters.days === "60" && !filters.startDate}
          >
            {labels.last60}
          </SegmentedLink>
        </SegmentedTrack>
      </div>

      <form
        method="GET"
        action={basePath}
        className="flex flex-wrap items-end gap-3"
      >
        {filters.agent && (
          <input type="hidden" name="agent" value={filters.agent} />
        )}
        {filters.map && <input type="hidden" name="map" value={filters.map} />}
        {filters.days && filters.days !== "0" && (
          <input type="hidden" name="days" value={filters.days} />
        )}
        {agentLinkOptions && (
          <span>
            <ListFilterDropdown
              label={labels.agentLabel}
              defaultLabel={labels.agentDefault}
              defaultHref={buildHref({ agent: "" })}
              activeLabel={agentActive}
              options={agentLinkOptions}
            />
          </span>
        )}
        <span>
          <ListFilterDropdown
            label={labels.mapLabel}
            defaultLabel={labels.mapDefault}
            defaultHref={buildHref({ map: "" })}
            activeLabel={mapActive}
            options={mapLinkOptions}
          />
        </span>

        <div className="flex flex-col gap-1.5">
          <span className="ml-1 block text-[9px] font-black tracking-[0.3em] text-neutral-600 uppercase">
            {labels.startDate} – {labels.endDate}
          </span>
          <div className="flex items-center overflow-hidden rounded-xl border border-neutral-800 bg-[var(--gcs-surface)]">
            <input
              type="date"
              name="startDate"
              defaultValue={filters.startDate}
              className="w-32 bg-transparent px-3 py-2.5 text-[11px] text-neutral-300 [color-scheme:dark] focus:outline-none"
            />
            <span className="px-1 text-neutral-700">–</span>
            <input
              type="date"
              name="endDate"
              defaultValue={filters.endDate}
              className="w-32 bg-transparent px-3 py-2.5 text-[11px] text-neutral-300 [color-scheme:dark] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-3 py-2.5 text-neutral-400 transition-colors hover:border-[#e4ae22]/40 hover:text-[#e4ae22]"
          aria-label={labels.submit}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

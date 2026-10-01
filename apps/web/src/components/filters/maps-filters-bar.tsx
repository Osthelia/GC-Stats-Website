/**
 * GC-Stats - maps-filters-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { ListFilterDropdown } from "@/components/filters/list-filter-dropdown";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { mapsFiltersHref, type MapsFilters } from "@/lib/maps-filters";

/** Filters of the team/tournament Maps tabs. The tournament dropdown only shows when `tournaments` is given. */
export async function MapsFiltersBar({
  basePath,
  filters,
  tournaments,
}: {
  basePath: string;
  filters: MapsFilters;
  tournaments?: { id: number; name: string }[];
}) {
  const t = await getTranslations("mapsFilters");

  const tournamentOptions = (tournaments ?? []).map((o) => ({ value: String(o.id), label: o.name, href: mapsFiltersHref(basePath, filters, { tournamentId: o.id }) }));
  const activeTournament = tournaments?.find((o) => o.id === filters.tournamentId)?.name ?? null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {tournamentOptions.length > 0 && (
        <ListFilterDropdown
          label={t("tournamentLabel")}
          defaultLabel={t("tournamentDefault")}
          defaultHref={mapsFiltersHref(basePath, filters, { tournamentId: null })}
          activeLabel={activeTournament}
          options={tournamentOptions}
        />
      )}
      <div>
        <span className="mb-1.5 ml-1 block text-[9px] font-black tracking-[0.3em] text-neutral-600 uppercase">{t("dateLabel")}</span>
        <DateRangeFilter
          path={basePath}
          hidden={{ tournament: filters.tournamentId != null ? String(filters.tournamentId) : null }}
          fromName="dateFrom"
          toName="dateTo"
          from={filters.dateFrom}
          to={filters.dateTo}
          fromLabel={t("dateFrom")}
          toLabel={t("dateTo")}
          applyLabel={t("apply")}
          clearLabel={t("clear")}
          clearHref={mapsFiltersHref(basePath, filters, { dateFrom: "", dateTo: "" })}
        />
      </div>
    </div>
  );
}

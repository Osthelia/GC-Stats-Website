/**
 * GC-Stats - production-section
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import type { ProductionPage } from "@/lib/production-credits-data";
import {
  buildProductionHref,
  sortColumnHref,
  type ParsedProductionParams,
} from "@/lib/production-list-params";
import { ProductionTable } from "@/components/production/production-table";
import { ListFilterDropdown } from "@/components/filters/list-filter-dropdown";
import { ListPagination } from "@/components/filters/list-pagination";
import { DateRangeFilter } from "@/components/filters/date-range-filter";

/** Role and date filters + table + pagination shared by the org/tournament/player "Production" tabs. */
export async function ProductionSection({
  page,
  parsed,
  pagePath,
  eventSortKey,
  eventColumnLabel,
  showPerson,
  showOrganization,
  currentTournamentId,
}: {
  page: ProductionPage;
  parsed: ParsedProductionParams<string>;
  pagePath: string;
  eventSortKey: string;
  eventColumnLabel: string;
  showPerson: boolean;
  showOrganization: boolean;
  currentTournamentId?: number;
}) {
  const t = await getTranslations("production");
  const tRoles = await getTranslations("production.role");
  const roleLabel = (role: string) => (tRoles.has(role) ? tRoles(role) : role);
  const hrefFor = (overrides: {
    page?: number;
    role?: string | null;
    from?: string | null;
    to?: string | null;
  }) =>
    buildProductionHref(pagePath, {
      sort: parsed.sort,
      direction: parsed.direction,
      page: overrides.page ?? 1,
      role: overrides.role === undefined ? parsed.role : overrides.role,
      from: overrides.from === undefined ? parsed.from : overrides.from,
      to: overrides.to === undefined ? parsed.to : overrides.to,
    });
  const hasFilter = !!(parsed.role || parsed.from || parsed.to);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {(page.roles.length > 0 || hasFilter) && (
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          {(page.roles.length > 1 || parsed.role) && (
            <ListFilterDropdown
              label={t("filterRole")}
              defaultLabel={t("allRoles")}
              defaultHref={hrefFor({ role: null })}
              activeLabel={parsed.role ? roleLabel(parsed.role) : null}
              options={page.roles.map((role) => ({
                value: role,
                label: roleLabel(role),
                href: hrefFor({ role }),
              }))}
            />
          )}
          <div>
            <span className="mb-1.5 ml-1 block text-[9px] font-black tracking-[0.3em] text-neutral-600 uppercase">
              {t("filterDateLabel")}
            </span>
            <DateRangeFilter
              path={pagePath}
              hidden={{
                sort: parsed.sort,
                dir: parsed.direction,
                role: parsed.role,
              }}
              fromName="from"
              toName="to"
              from={parsed.from ?? ""}
              to={parsed.to ?? ""}
              fromLabel={t("filterDateFrom")}
              toLabel={t("filterDateTo")}
              applyLabel={t("filterDateApply")}
              clearLabel={t("filterDateClear")}
              clearHref={hrefFor({ from: null, to: null })}
            />
          </div>
        </div>
      )}

      <ProductionTable
        entries={page.items}
        showPerson={showPerson}
        showOrganization={showOrganization}
        currentTournamentId={currentTournamentId}
        eventColumnLabel={eventColumnLabel}
        emptyLabel={hasFilter ? t("emptyFiltered") : undefined}
        eventSort={{
          href: sortColumnHref(pagePath, parsed, eventSortKey, "asc"),
          active: parsed.sort === eventSortKey,
          direction: parsed.direction,
        }}
        dateSort={{
          href: sortColumnHref(pagePath, parsed, "date"),
          active: parsed.sort === "date",
          direction: parsed.direction,
        }}
      />

      <ListPagination
        page={page.page}
        totalPages={page.totalPages}
        prevHref={hrefFor({ page: page.page - 1 })}
        nextHref={hrefFor({ page: page.page + 1 })}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageOfLabel={t("pageOf", { page: page.page, total: page.totalPages })}
      />
    </div>
  );
}

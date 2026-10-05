/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import {
  listPublicMatches,
  MATCHES_PAGE_SIZE,
  type MatchListSort,
  type MatchListStatus,
  type SortDirection,
} from "@/lib/match-list-data";
import { RED, tint } from "@/lib/theme-colors";
import { Link } from "@/i18n/navigation";
import { FilterPill, SortPill } from "@/components/filters/filter-pill";
import { FilterBar, FilterBarRow } from "@/components/filters/filter-bar";
import { ListPagination } from "@/components/filters/list-pagination";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { GlobalMatchRow } from "@/components/matches/global-match-row";

export default async function MatchesIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [t, home] = await Promise.all([getTranslations("matchesPage"), getTranslations("home")]);

  const raw = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const region = raw(params.region);
  const category = raw(params.category);
  const dateFrom = raw(params.dateFrom);
  const dateTo = raw(params.dateTo);
  const statusParam = raw(params.status);
  const status: MatchListStatus =
    statusParam === "live" ||
    statusParam === "upcoming" ||
    statusParam === "finished"
      ? statusParam
      : "all";
  const sortParam = raw(params.sort);
  const sort: MatchListSort =
    sortParam === "tournament" ? "tournament" : "date";
  const directionParam = raw(params.direction);
  const defaultDirection: SortDirection =
    sort === "tournament" ? "asc" : "desc";
  const direction: SortDirection =
    directionParam === "asc" || directionParam === "desc"
      ? directionParam
      : defaultDirection;
  const requestedPage = Math.max(1, Number(raw(params.page)) || 1);

  const { rows, total, regions, categories, statusCounts, usedFallback, page } =
    await listPublicMatches({
      status,
      region,
      category,
      dateFrom,
      dateTo,
      sort,
      direction,
      page: requestedPage,
    });
  const totalPages = Math.max(1, Math.ceil(total / MATCHES_PAGE_SIZE));

  const buildHref = (
    overrides: Partial<{
      region: string;
      category: string;
      dateFrom: string;
      dateTo: string;
      status: string;
      sort: string;
      direction: string;
      page: number;
    }>,
  ) => {
    const next = {
      region: overrides.region !== undefined ? overrides.region : region,
      category:
        overrides.category !== undefined ? overrides.category : category,
      dateFrom:
        overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom,
      dateTo: overrides.dateTo !== undefined ? overrides.dateTo : dateTo,
      status: overrides.status !== undefined ? overrides.status : status,
      sort: overrides.sort !== undefined ? overrides.sort : sort,
      direction:
        overrides.direction !== undefined ? overrides.direction : direction,
      page: overrides.page !== undefined ? overrides.page : page,
    };
    const qs = new URLSearchParams();
    if (next.region) qs.set("region", next.region);
    if (next.category) qs.set("category", next.category);
    if (next.dateFrom) qs.set("dateFrom", next.dateFrom);
    if (next.dateTo) qs.set("dateTo", next.dateTo);
    if (next.status !== "all") qs.set("status", next.status);
    if (next.sort !== "date") qs.set("sort", next.sort);
    if (next.direction !== (next.sort === "tournament" ? "asc" : "desc"))
      qs.set("direction", next.direction);
    if (next.page !== 1) qs.set("page", String(next.page));
    const s = qs.toString();
    return `/match${s ? `?${s}` : ""}`;
  };

  const nextDirectionFor = (targetSort: MatchListSort) =>
    sort !== targetSort
      ? targetSort === "tournament"
        ? "asc"
        : "desc"
      : direction === "asc"
        ? "desc"
        : "asc";

  const statusTabs: { key: MatchListStatus; label: string; live?: boolean }[] =
    [
      { key: "all", label: home("tabAll") },
      { key: "live", label: home("tabLive"), live: true },
      { key: "upcoming", label: home("tabUpcoming") },
      { key: "finished", label: home("tabResults") },
    ];

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-1 text-2xl font-black text-neutral-50">{t("title")}</h1>
      <p className="mb-6 text-sm text-[var(--gcs-text-tertiary)]">
        {t("resultsCount", { count: total })}
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map((tab) => {
            const on = status === tab.key;
            const isLive = !!tab.live;
            return (
              <Link
                key={tab.key}
                href={buildHref({ status: tab.key, page: 1 })}
                className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] transition-all hover:-translate-y-px active:translate-y-0"
                style={{
                  background: on
                    ? isLive
                      ? RED
                      : "var(--gcs-text)"
                    : "transparent",
                  color: on
                    ? "var(--gcs-bg)"
                    : isLive
                      ? "#d8888b"
                      : "var(--gcs-text-secondary)",
                  borderColor: on
                    ? isLive
                      ? RED
                      : "var(--gcs-text)"
                    : isLive
                      ? tint(RED, 0.35)
                      : "var(--gcs-border)",
                  fontWeight: on ? 600 : 500,
                }}
              >
                {tab.live && (
                  <span
                    className="h-1.5 w-1.5 flex-none animate-pulse rounded-full"
                    style={{ background: on ? "var(--gcs-bg)" : RED }}
                  />
                )}
                <span>{tab.label}</span>
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{
                    color: on
                      ? "color-mix(in srgb, var(--gcs-bg) 55%, transparent)"
                      : "var(--gcs-text-tertiary)",
                  }}
                >
                  {statusCounts[tab.key]}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--gcs-text-tertiary)]">
            {t("sortLabel")}
          </span>
          <SortPill
            href={buildHref({
              sort: "date",
              direction: nextDirectionFor("date"),
              page: 1,
            })}
            active={sort === "date"}
            label={t("sortDate")}
          />
          <SortPill
            href={buildHref({
              sort: "tournament",
              direction: nextDirectionFor("tournament"),
              page: 1,
            })}
            active={sort === "tournament"}
            label={t("sortTournament")}
          />
        </div>
      </div>

      <FilterBar
        mobileToggle={{
          label: t("filtersToggle"),
          activeCount: [region, category, dateFrom || dateTo].filter(Boolean)
            .length,
        }}
      >
        <FilterBarRow label={t("filterRegionLabel")}>
          <FilterPill
            href={buildHref({ region: "", page: 1 })}
            active={!region}
            label={t("filterAllRegions")}
          />
          {regions.map((r) => (
            <FilterPill
              key={r}
              href={buildHref({ region: r, page: 1 })}
              active={region === r}
              label={r}
            />
          ))}
        </FilterBarRow>

        <FilterBarRow label={t("filterCategoryLabel")}>
          <FilterPill
            href={buildHref({ category: "", page: 1 })}
            active={!category}
            label={t("filterAllCategories")}
          />
          {categories.map((c) => (
            <FilterPill
              key={c}
              href={buildHref({ category: c, page: 1 })}
              active={category === c}
              label={c}
            />
          ))}
        </FilterBarRow>

        <FilterBarRow label={t("filterDateLabel")}>
          <DateRangeFilter
            path="/match"
            hidden={{
              region,
              category,
              status: status !== "all" ? status : null,
              sort: sort !== "date" ? sort : null,
              direction:
                direction !== (sort === "tournament" ? "asc" : "desc")
                  ? direction
                  : null,
            }}
            fromName="dateFrom"
            toName="dateTo"
            from={dateFrom}
            to={dateTo}
            fromLabel={t("filterDateFrom")}
            toLabel={t("filterDateTo")}
            applyLabel={t("filterDateApply")}
            clearLabel={t("filterDateClear")}
            clearHref={buildHref({ dateFrom: "", dateTo: "", page: 1 })}
          />
        </FilterBarRow>
      </FilterBar>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">
          {t("noResults")}
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {usedFallback && (
            <p className="rounded-lg border border-[#5c4c22] bg-[#e4ae22]/10 px-3.5 py-2.5 text-xs font-medium text-[#e4ae22]">
              {t("fallbackNotice")}
            </p>
          )}
          {rows.map((m) => (
            <GlobalMatchRow key={m.id} match={m} vsLabel={home("vs")} />
          ))}
        </div>
      )}

      <ListPagination
        page={page}
        totalPages={totalPages}
        prevHref={buildHref({ page: page - 1 })}
        nextHref={buildHref({ page: page + 1 })}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageOfLabel={t("pageOf", { page, total: totalPages })}
      />
    </div>
  );
}

/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getLocale, getTranslations } from "next-intl/server";
import {
  listPublicTournaments,
  TOURNAMENTS_PAGE_SIZE,
  type TournamentListSort,
  type SortDirection,
} from "@/lib/tournament-list-data";
import { normalizeRegion, REGIONS, RED, tint } from "@/lib/home-fake-data";
import { slugify } from "@/lib/entity-id";
import { Link } from "@/i18n/navigation";
import { FilterPill, SortPill } from "@/components/filters/filter-pill";
import { FilterBar, FilterBarRow } from "@/components/filters/filter-bar";
import { ListPagination } from "@/components/filters/list-pagination";
import { TournamentBadge } from "@/components/tournament/tournament-badge";

// One formatter per locale, reused by every card.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

// Calendar dates (no time of day): formatted in UTC so no timezone shifts the day.
function fmtDate(locale: string, d: string) {
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(`${d.slice(0, 10)}T00:00:00Z`));
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("tournamentsPage"), getLocale()]);

  const raw = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const region = raw(params.region);
  const category = raw(params.category);
  const year = raw(params.year);
  const sortParam = raw(params.sort);
  const sort: TournamentListSort = sortParam === "name" ? "name" : "date";
  const directionParam = raw(params.direction);
  const defaultDirection: SortDirection = sort === "name" ? "asc" : "desc";
  const direction: SortDirection =
    directionParam === "asc" || directionParam === "desc"
      ? directionParam
      : defaultDirection;
  const page = Math.max(1, Number(raw(params.page)) || 1);

  const { rows, total, regions, categories, years } =
    await listPublicTournaments({
      region,
      category,
      year,
      sort,
      direction,
      page,
    });
  const totalPages = Math.max(1, Math.ceil(total / TOURNAMENTS_PAGE_SIZE));

  const buildHref = (
    overrides: Partial<{
      region: string;
      category: string;
      year: string;
      sort: string;
      direction: string;
      page: number;
    }>,
  ) => {
    const next = {
      region: overrides.region !== undefined ? overrides.region : region,
      category:
        overrides.category !== undefined ? overrides.category : category,
      year: overrides.year !== undefined ? overrides.year : year,
      sort: overrides.sort !== undefined ? overrides.sort : sort,
      direction:
        overrides.direction !== undefined ? overrides.direction : direction,
      page: overrides.page !== undefined ? overrides.page : page,
    };
    const qs = new URLSearchParams();
    if (next.region) qs.set("region", next.region);
    if (next.category) qs.set("category", next.category);
    if (next.year) qs.set("year", next.year);
    if (next.sort !== "date") qs.set("sort", next.sort);
    if (next.direction !== (next.sort === "name" ? "asc" : "desc"))
      qs.set("direction", next.direction);
    if (next.page !== 1) qs.set("page", String(next.page));
    const s = qs.toString();
    return `/tournaments${s ? `?${s}` : ""}`;
  };

  const nextDirectionFor = (targetSort: TournamentListSort) =>
    sort !== targetSort
      ? targetSort === "name"
        ? "asc"
        : "desc"
      : direction === "asc"
        ? "desc"
        : "asc";

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-1 text-2xl font-black text-neutral-50">{t("title")}</h1>
      <p className="mb-6 text-sm text-[var(--gcs-text-tertiary)]">
        {t("resultsCount", { count: total })}
      </p>

      <div className="mb-4 flex items-center justify-end gap-1.5">
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
            sort: "name",
            direction: nextDirectionFor("name"),
            page: 1,
          })}
          active={sort === "name"}
          label={t("sortName")}
        />
      </div>

      <FilterBar
        mobileToggle={{
          label: t("filtersToggle"),
          activeCount: [region, category, year].filter(Boolean).length,
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

        <FilterBarRow label={t("filterYearLabel")}>
          <FilterPill
            href={buildHref({ year: "", page: 1 })}
            active={!year}
            label={t("filterAllYears")}
          />
          {years.map((y) => (
            <FilterPill
              key={y}
              href={buildHref({ year: String(y), page: 1 })}
              active={year === String(y)}
              label={String(y)}
            />
          ))}
        </FilterBarRow>
      </FilterBar>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">
          {t("noResults")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((tour) => {
            const regionMeta = REGIONS[normalizeRegion(tour.region)];
            const href = `/tournaments/${tour.id}/${slugify(tour.name)}`;
            return (
              <Link
                key={tour.id}
                href={href}
                className="flex flex-col gap-3 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface-3)] p-4 transition-all hover:border-neutral-700 hover:bg-[var(--gcs-hover)] active:scale-[0.99]"
                style={{ borderLeft: `3px solid ${regionMeta.color}` }}
              >
                <div className="flex items-start gap-3">
                  <TournamentBadge
                    name={tour.name}
                    logoUrl={tour.logoUrl}
                    logoUrlLight={tour.logoUrlLight}
                    size={40}
                    bare
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-[15px] leading-snug font-bold tracking-tight break-words text-neutral-50">
                      {tour.name}
                    </h2>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-neutral-500">
                      <span
                        className="font-medium"
                        style={{ color: regionMeta.color }}
                      >
                        {regionMeta.label}
                      </span>
                      {tour.category && (
                        <>
                          <span className="h-[3px] w-[3px] flex-none rounded-full bg-neutral-700" />
                          <span className="truncate">{tour.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {tour.status === "live" && (
                    <span
                      className="flex flex-none items-center gap-1.5 self-start rounded-md px-1.5 py-0.5"
                      style={{ background: tint(RED, 0.16) }}
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span
                          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                          style={{ background: RED }}
                        />
                        <span
                          className="relative inline-flex h-1.5 w-1.5 rounded-full"
                          style={{ background: RED }}
                        />
                      </span>
                      <span
                        className="text-[10px] font-black tracking-wide"
                        style={{ color: RED }}
                      >
                        {t("live")}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-neutral-800/70 pt-3">
                  <span className="font-mono text-[11px] text-neutral-500">
                    {fmtDate(locale, tour.startDate)} -{" "}
                    {fmtDate(locale, tour.endDate)}
                  </span>
                  <div className="flex flex-none items-center gap-3 text-[11.5px] text-neutral-400">
                    <span className="flex items-center gap-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="flex-none"
                      >
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                      </svg>
                      {tour.teamsCount}
                    </span>
                    {tour.prizePool && (
                      <span className="truncate font-semibold text-neutral-300">
                        {tour.prizePool}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
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

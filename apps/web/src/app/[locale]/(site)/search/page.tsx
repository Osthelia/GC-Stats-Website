/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getLocale, getTranslations } from "next-intl/server";
import { Link, getPathname } from "@/i18n/navigation";
import {
  searchGlobal,
  type SearchResultItem,
  type SearchResultType,
} from "@/lib/search";
import { CountryBadge } from "@/components/team/country-badge";
import { FilterPill, SortPill } from "@/components/filters/filter-pill";
import { ListPagination } from "@/components/filters/list-pagination";
import { ThemedLogoImage } from "@/components/site/themed-logo-image";
import { SearchQueryField } from "@/components/search/search-query-field";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("searchPage.title");

const TYPE_ORDER: SearchResultType[] = [
  "team",
  "player",
  "tournament",
  "organization",
];
type SortKey = "relevance" | "name" | "popularity";
const PAGE_SIZE = 20;
// Same limits as V1's SearchController (perTypeLimit: 50, candidateLimit: 100).
const PER_TYPE_LIMIT = 50;
const CANDIDATE_LIMIT = 100;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("searchPage");
  const tTypes = await getTranslations("globalSearch.type");
  const locale = await getLocale();

  const raw = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const query = raw(params.q).trim();
  const typeFilter = raw(params.type) as SearchResultType | "";
  const sortParam = raw(params.sort);
  const sort: SortKey =
    sortParam === "name"
      ? "name"
      : sortParam === "popularity"
        ? "popularity"
        : "relevance";
  const page = Math.max(1, Number(raw(params.page)) || 1);

  const results =
    query.length >= 2
      ? await searchGlobal(query, {
          perTypeLimit: PER_TYPE_LIMIT,
          candidateLimit: CANDIDATE_LIMIT,
        })
      : { team: [], player: [], tournament: [], organization: [] };

  const counts: Record<SearchResultType, number> = {
    team: results.team.length,
    player: results.player.length,
    tournament: results.tournament.length,
    organization: results.organization.length,
  };
  const totalCount =
    counts.team + counts.player + counts.tournament + counts.organization;

  // Mirrors V1's SearchController: types are flattened together first, then
  // the whole list is sorted once ("relevance" score and "popularity" mix
  // teams, players, tournaments and organizations by rank rather than grouping
  // by type first).
  const items: SearchResultItem[] = TYPE_ORDER.filter(
    (type) => !typeFilter || type === typeFilter,
  )
    .flatMap((type) => results[type])
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "popularity"
          ? b.popularity - a.popularity
          : b.score - a.score,
    );

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const linkFor = (
    overrides: Partial<{ type: string; sort: string; page: number }>,
  ) => {
    const qs = new URLSearchParams();
    if (query) qs.set("q", query);
    const nextType = overrides.type !== undefined ? overrides.type : typeFilter;
    const nextSort = overrides.sort !== undefined ? overrides.sort : sort;
    const nextPage = overrides.page !== undefined ? overrides.page : page;
    if (nextType) qs.set("type", nextType);
    if (nextSort !== "relevance") qs.set("sort", nextSort);
    if (nextPage !== 1) qs.set("page", String(nextPage));
    return `/search?${qs.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-10">
      <h1 className="mb-1 text-2xl font-black text-neutral-50">{t("title")}</h1>
      <p className="mb-6 text-sm text-[var(--gcs-text-tertiary)]">
        {query.length >= 2 ? t("resultsFor", { query }) : t("typeAhead")}
      </p>

      <form
        action={getPathname({ href: "/search", locale })}
        method="GET"
        className="mb-6 flex h-11 items-center gap-2 rounded-[10px] border border-neutral-800 bg-[var(--gcs-surface)] px-4"
      >
        <SearchQueryField
          name="q"
          defaultValue={query}
          placeholder={t("placeholder")}
          clearLabel={t("clear")}
        />
      </form>

      {query.length >= 2 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <FilterPill
                href={linkFor({ type: "", page: 1 })}
                active={!typeFilter}
                label={t("filterAll")}
                count={totalCount}
              />
              {TYPE_ORDER.map((type) => (
                <FilterPill
                  key={type}
                  href={linkFor({ type, page: 1 })}
                  active={typeFilter === type}
                  label={tTypes(type)}
                  count={counts[type]}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--gcs-text-tertiary)]">
                {t("sortLabel")}
              </span>
              <SortPill
                href={linkFor({ sort: "relevance", page: 1 })}
                active={sort === "relevance"}
                label={t("sortRelevance")}
              />
              <SortPill
                href={linkFor({ sort: "name", page: 1 })}
                active={sort === "name"}
                label={t("sortName")}
              />
              <SortPill
                href={linkFor({ sort: "popularity", page: 1 })}
                active={sort === "popularity"}
                label={t("sortPopularity")}
              />
            </div>
          </div>

          {items.length === 0 ? (
            <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-8 text-center text-sm text-[var(--gcs-text-tertiary)]">
              {t("noResults", { query })}
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[var(--gcs-text-tertiary)]">
                {t("resultsCount", { count: items.length })}
              </p>
              <div className="overflow-hidden rounded-xl border border-neutral-800">
                {pageItems.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={`/${item.path}`}
                    className="flex items-center gap-3 border-b border-neutral-800 bg-[var(--gcs-surface)] px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-[var(--gcs-hover)]"
                  >
                    {item.logoUrl || item.logoUrlLight ? (
                      <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-md border border-neutral-800 bg-[var(--gcs-surface-2)]">
                        <ThemedLogoImage
                          dark={item.logoUrl ?? item.logoUrlLight!}
                          light={item.logoUrlLight ?? item.logoUrl!}
                          alt=""
                          width={32}
                          height={32}
                          className="h-full w-full object-contain"
                        />
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-neutral-800 bg-[var(--gcs-surface-2)] text-xs font-black text-neutral-500 uppercase">
                        {item.title.charAt(0)}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <CountryBadge
                        code={item.countryCode}
                        secondaryCode={item.secondaryCountryCode}
                      />
                      <span className="truncate font-semibold text-neutral-50">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="truncate text-xs text-[var(--gcs-text-tertiary)]">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    <span className="flex-none rounded px-1.5 py-0.5 font-mono text-[9px] font-black tracking-widest text-[#e4ae22]/80 uppercase">
                      {tTypes(item.type)}
                    </span>
                  </Link>
                ))}
              </div>

              <ListPagination
                page={page}
                totalPages={totalPages}
                prevHref={linkFor({ page: page - 1 })}
                nextHref={linkFor({ page: page + 1 })}
                previousLabel={t("previous")}
                nextLabel={t("next")}
                pageOfLabel={t("pageOf", { page, total: totalPages })}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

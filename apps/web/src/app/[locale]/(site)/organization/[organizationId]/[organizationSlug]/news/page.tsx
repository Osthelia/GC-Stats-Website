/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { parseEntityId } from "@/lib/entity-id";
import { redirectIfOrganizationLinked } from "@/lib/organization-team-link";
import { getOrganizationPageInfo, getOrganizationMembers, getOrganizationNewsPage } from "@/lib/organization-page-data";
import { listActiveNewsLanguages, resolveNewsLanguages } from "@/lib/news-languages";
import { OrganizationHeader } from "@/components/organization/organization-header";
import { NewsLanguageFilter } from "@/components/news/news-language-filter";
import { NewsArticleCard } from "@/components/news/news-article-card";
import { FilterBar, FilterBarRow } from "@/components/filters/filter-bar";
import { ListPagination } from "@/components/filters/list-pagination";
import type { AppLocale } from "@/i18n/routing";
import type { Metadata } from "next";
import { organizationPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale, organizationId } = await params;
  return organizationPageMetadata(locale, organizationId, "tabNews");
}

export default async function OrganizationNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; organizationId: string; organizationSlug: string }>;
  searchParams: Promise<{ languages?: string; dateFrom?: string; dateTo?: string; page?: string }>;
}) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const organization = await getOrganizationPageInfo(id);
  if (!organization) notFound();
  await redirectIfOrganizationLinked(id, locale);

  const basePath = `/organization/${organization.id}/${organization.slug}/news`;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const dateFrom = sp.dateFrom ?? "";
  const dateTo = sp.dateTo ?? "";

  const languageOptions = await listActiveNewsLanguages();
  const languages = sp.languages ? sp.languages.split(",").filter(Boolean) : await resolveNewsLanguages(locale as AppLocale);

  const [{ items: articles, total, perPage }, members, t, tNews] = await Promise.all([
    getOrganizationNewsPage(id, organization, { languages, dateFrom, dateTo, page }),
    getOrganizationMembers(id),
    getTranslations("organizationPage"),
    getTranslations("newsPage"),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const languageNameByCode = new Map(languageOptions.map((l) => [l.code, l.name]));

  const buildHref = (overrides: Partial<{ dateFrom: string; dateTo: string; page: number }>) => {
    const nextDateFrom = overrides.dateFrom !== undefined ? overrides.dateFrom : dateFrom;
    const nextDateTo = overrides.dateTo !== undefined ? overrides.dateTo : dateTo;
    const nextPage = overrides.page !== undefined ? overrides.page : page;
    const qs = new URLSearchParams();
    qs.set("languages", languages.join(","));
    if (nextDateFrom) qs.set("dateFrom", nextDateFrom);
    if (nextDateTo) qs.set("dateTo", nextDateTo);
    if (nextPage !== 1) qs.set("page", String(nextPage));
    return `${basePath}?${qs.toString()}`;
  };

  return (
    <div>
      <OrganizationHeader organization={organization} segment={`${organization.id}/${organization.slug}`} activeTab="news" memberCount={members.current.length} />

      <div className="mx-auto max-w-[1100px] px-6 py-10">
        <p className="mb-6 text-sm text-[var(--gcs-text-tertiary)]">{tNews("resultsCount", { count: total })}</p>

        <div className="mb-4">
          <NewsLanguageFilter basePath={basePath} activeLanguages={languages} options={languageOptions} />
        </div>

        <FilterBar>
          <FilterBarRow label={tNews("filterDateLabel")}>
            <form method="GET" action={basePath} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="languages" value={languages.join(",")} />
              <div className="flex items-center gap-1.5 overflow-hidden rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-2.5 py-1">
                <input type="date" name="dateFrom" defaultValue={dateFrom} className="w-[124px] bg-transparent text-xs text-neutral-300 [color-scheme:dark] focus:outline-none" />
                <span className="text-neutral-700">–</span>
                <input type="date" name="dateTo" defaultValue={dateTo} className="w-[124px] bg-transparent text-xs text-neutral-300 [color-scheme:dark] focus:outline-none" />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--gcs-text-dim)] transition-colors hover:border-[#e4ae22]/40 hover:text-[#e4ae22]"
              >
                {tNews("filterDateApply")}
              </button>
              {(dateFrom || dateTo) && (
                <Link href={buildHref({ dateFrom: "", dateTo: "", page: 1 })} className="text-xs font-medium text-neutral-500 hover:text-neutral-300">
                  {tNews("filterDateClear")}
                </Link>
              )}
            </form>
          </FilterBarRow>
        </FilterBar>

        {articles.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">{t("noNews")}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((item) => (
                <NewsArticleCard key={item.id} item={item} languageName={languageNameByCode.get(item.lang) ?? item.lang} featuredLabel={tNews("featured")} />
              ))}
            </div>

            <ListPagination
              page={page}
              totalPages={totalPages}
              prevHref={buildHref({ page: page - 1 })}
              nextHref={buildHref({ page: page + 1 })}
              previousLabel={tNews("previous")}
              nextLabel={tNews("next")}
              pageOfLabel={tNews("pageOf", { page, total: totalPages })}
            />
          </>
        )}
      </div>
    </div>
  );
}

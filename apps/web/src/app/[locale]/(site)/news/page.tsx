/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getTranslations } from "next-intl/server";
import { getPublicNewsIndex } from "@/lib/news-page-data";
import { listActiveNewsLanguages, resolveNewsLanguages } from "@/lib/news-languages";
import { NewsLanguageFilter } from "@/components/news/news-language-filter";
import { NewsArticleCard } from "@/components/news/news-article-card";
import { ListPagination } from "@/components/filters/list-pagination";
import type { AppLocale } from "@/i18n/routing";
import { staticTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = staticTitleMetadata("newsPage.title");

export default async function NewsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ languages?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("newsPage");

  const languageOptions = await listActiveNewsLanguages();
  const languages = sp.languages ? sp.languages.split(",").filter(Boolean) : await resolveNewsLanguages(locale as AppLocale);
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total, perPage } = await getPublicNewsIndex({ languages, page });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const languageNameByCode = new Map(languageOptions.map((l) => [l.code, l.name]));

  const buildHref = (nextPage: number) => `/news?languages=${languages.join(",")}${nextPage !== 1 ? `&page=${nextPage}` : ""}`;

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-1 text-2xl font-black text-neutral-50">{t("title")}</h1>
      <p className="mb-6 text-sm text-[var(--gcs-text-tertiary)]">{t("resultsCount", { count: total })}</p>

      <div className="mb-6">
        <NewsLanguageFilter basePath="/news" activeLanguages={languages} options={languageOptions} />
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-10 text-center text-sm text-[var(--gcs-text-tertiary)]">{t("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsArticleCard key={item.id} item={item} languageName={languageNameByCode.get(item.lang) ?? item.lang} featuredLabel={t("featured")} />
          ))}
        </div>
      )}

      <ListPagination
        page={page}
        totalPages={totalPages}
        prevHref={buildHref(page - 1)}
        nextHref={buildHref(page + 1)}
        previousLabel={t("previous")}
        nextLabel={t("next")}
        pageOfLabel={t("pageOf", { page, total: totalPages })}
      />
    </div>
  );
}

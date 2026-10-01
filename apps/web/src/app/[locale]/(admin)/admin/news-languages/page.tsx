/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { NewsLanguagesPanel } from "@/components/admin/news-languages-panel";
import { listAdminNewsLanguages, NEWS_LANGUAGES_PAGE_SIZE, type NewsLanguageSort, type SortDirection } from "@/lib/admin-news-languages";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: NewsLanguageSort[] = ["code", "name", "sortOrder"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.newsLanguages" });
  return { title: t("title") };
}

export default async function AdminNewsLanguagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.newsLanguagesView);
  const t = await getTranslations({ locale, namespace: "admin.newsLanguages" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as NewsLanguageSort) : "sortOrder";
  const direction: SortDirection = sp.direction === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows: languages, total } = await listAdminNewsLanguages({ q, sort, direction, page });
  const totalPages = Math.max(1, Math.ceil(total / NEWS_LANGUAGES_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.newsLanguagesManage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AdminSearchSortBar
        searchPlaceholder={t("searchPlaceholder")}
        searchSubmitLabel={t("searchSubmit")}
        searchValue={q}
        sort={sort}
        direction={direction}
        activeWithinValue=""
        activeWithinLabel=""
        activeWithinOptions={[]}
        statusValue=""
        statusLabel=""
        statusOptions={[]}
      />

      <NewsLanguagesPanel
        languages={languages}
        canManage={canManage}
        sortable={{ pathname: "/admin/news-languages", sort, direction, query: { q, sort, direction } }}
        pagination={{ page, totalPages, total }}
      />
    </div>
  );
}

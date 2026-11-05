/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AnalyticsTopPagesTable } from "@/components/admin/analytics-top-pages-table";
import { listTopPages, TOP_PAGES_PAGE_SIZE, type TopPageSort, type SortDirection } from "@/lib/admin-analytics";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: TopPageSort[] = ["page", "views"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.analytics" });
  return { title: t("title") };
}

export default async function AdminAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requireAdminPermission(locale as AppLocale, PERMISSIONS.analyticsView);
  const t = await getTranslations({ locale, namespace: "admin.analytics" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as TopPageSort) : "views";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows: topPages, total } = await listTopPages({ q, sort, direction, page });
  const totalPages = Math.max(1, Math.ceil(total / TOP_PAGES_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("topPagesHeading")}</h2>

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

        <AnalyticsTopPagesTable rows={topPages} sortable={{ pathname: "/admin/analytics", sort, direction, query: { q, sort, direction } }} pagination={{ page, totalPages, total }} />
      </div>
    </div>
  );
}

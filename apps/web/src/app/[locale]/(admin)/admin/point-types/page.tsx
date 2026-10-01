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
import { PointTypesPanel } from "@/components/admin/point-types-panel";
import { listAdminPointTypes, POINT_TYPES_PAGE_SIZE, type PointTypeSort, type SortDirection } from "@/lib/admin-point-types";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: PointTypeSort[] = ["name", "label", "startDate", "endDate"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.pointTypes" });
  return { title: t("title") };
}

export default async function AdminPointTypesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.pointTypesView);
  const t = await getTranslations({ locale, namespace: "admin.pointTypes" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as PointTypeSort) : "name";
  const direction: SortDirection = sp.direction === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows: pointTypes, total } = await listAdminPointTypes({ q, sort, direction, page });
  const totalPages = Math.max(1, Math.ceil(total / POINT_TYPES_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.pointTypesManage);

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

      <PointTypesPanel
        pointTypes={pointTypes}
        canManage={canManage}
        sortable={{ pathname: "/admin/point-types", sort, direction, query: { q, sort, direction } }}
        pagination={{ page, totalPages, total }}
      />
    </div>
  );
}

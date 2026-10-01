/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ChangeRequestsPanel } from "@/components/admin/change-requests-panel";
import {
  listAdminChangeRequests,
  getAdminChangeRequestCounts,
  CHANGE_REQUESTS_PAGE_SIZE,
  type ChangeRequestSort,
  type ChangeRequestStatus,
  type SortDirection,
} from "@/lib/admin-change-requests";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: ChangeRequestSort[] = ["createdAt", "status"];
const STATUS_VALUES: ChangeRequestStatus[] = ["pending", "approved", "rejected", "partial", "withdrawn"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.changeRequests" });
  return { title: t("title") };
}

export default async function AdminChangeRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requireAdminPermission(locale as AppLocale, PERMISSIONS.changeRequestsView);
  const t = await getTranslations({ locale, namespace: "admin.changeRequests" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as ChangeRequestSort) : "createdAt";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const status = (STATUS_VALUES as string[]).includes(sp.status ?? "") ? (sp.status as ChangeRequestStatus) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, total }, counts] = await Promise.all([listAdminChangeRequests({ q, status, sort, direction, page }), getAdminChangeRequestCounts()]);
  const totalPages = Math.max(1, Math.ceil(total / CHANGE_REQUESTS_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminStatCard label={t("statusPending")} value={counts.pending} icon={Clock} color="amber" />
        <AdminStatCard label={t("statusApproved")} value={counts.approved} icon={CheckCircle2} color="emerald" />
        <AdminStatCard label={t("statusRejected")} value={counts.rejected} icon={XCircle} color="destructive" />
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
        statusValue={status}
        statusLabel={t("statusLabel")}
        statusOptions={[
          { value: "", label: t("statusAny") },
          { value: "pending", label: t("statusPending") },
          { value: "approved", label: t("statusApproved") },
          { value: "rejected", label: t("statusRejected") },
          { value: "partial", label: t("statusPartial") },
          { value: "withdrawn", label: t("statusWithdrawn") },
        ]}
      />

      <ChangeRequestsPanel rows={rows} sortable={{ pathname: "/admin/change-requests", sort, direction, query: { q, status, sort, direction } }} />

      <AdminPagination pathname="/admin/change-requests" page={page} totalPages={totalPages} total={total} query={{ q, status, sort, direction }} label={`${total}`} />
    </div>
  );
}

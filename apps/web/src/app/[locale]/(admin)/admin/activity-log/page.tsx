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
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ActivityLogPanel } from "@/components/admin/activity-log-panel";
import { listAdminActivityLog, getAdminActivityLogFilterOptions, ACTIVITY_LOG_PAGE_SIZE } from "@/lib/admin-activity-log";
import { requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.activityLog" });
  return { title: t("title") };
}

export default async function AdminActivityLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; activeWithin?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requireAdminPermission(locale as AppLocale, PERMISSIONS.activityLogView);
  const t = await getTranslations({ locale, namespace: "admin.activityLog" });

  const q = (sp.q ?? "").trim();
  const { logNames, events } = await getAdminActivityLogFilterOptions();
  const logName = logNames.includes(sp.activeWithin ?? "") ? (sp.activeWithin ?? "") : "";
  const event = events.includes(sp.status ?? "") ? (sp.status ?? "") : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total } = await listAdminActivityLog({ q, logName, event, page });
  const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_LOG_PAGE_SIZE));

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
        sort=""
        direction="desc"
        activeWithinValue={logName}
        activeWithinLabel={t("logNameLabel")}
        activeWithinOptions={[{ value: "", label: t("logNameAny") }, ...logNames.map((v) => ({ value: v, label: v }))]}
        statusValue={event}
        statusLabel={t("eventLabel")}
        statusOptions={[{ value: "", label: t("eventAny") }, ...events.map((v) => ({ value: v, label: t.has(`event.${v}`) ? t(`event.${v}`) : v }))]}
      />

      <ActivityLogPanel rows={rows} />

      <AdminPagination pathname="/admin/activity-log" page={page} totalPages={totalPages} total={total} query={{ q, activeWithin: logName, status: event }} label={`${total}`} />
    </div>
  );
}

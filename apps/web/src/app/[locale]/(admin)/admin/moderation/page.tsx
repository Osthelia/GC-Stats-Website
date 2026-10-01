/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Clock, ShieldOff, ShieldCheck } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ModerationSuspectsPanel } from "@/components/admin/moderation-suspects-panel";
import {
  listAdminModerationSuspects,
  getAdminModerationSuspectCounts,
  MODERATION_SUSPECTS_PAGE_SIZE,
  type ModerationSuspectSort,
  type ModerationSuspectStatus,
  type SortDirection,
} from "@/lib/admin-moderation-suspects";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: ModerationSuspectSort[] = ["id", "status", "source"];
const STATUS_VALUES: ModerationSuspectStatus[] = ["pending", "dismissed", "actioned"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.moderation" });
  return { title: t("title") };
}

export default async function AdminModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.moderationView);
  const t = await getTranslations({ locale, namespace: "admin.moderation" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as ModerationSuspectSort) : "id";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const status = (STATUS_VALUES as string[]).includes(sp.status ?? "") ? (sp.status as ModerationSuspectStatus) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, total }, counts] = await Promise.all([listAdminModerationSuspects({ q, status, sort, direction, page }), getAdminModerationSuspectCounts()]);
  const totalPages = Math.max(1, Math.ceil(total / MODERATION_SUSPECTS_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.moderationManage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminStatCard label={t("statPending")} value={counts.pending} icon={Clock} color="amber" />
        <AdminStatCard label={t("statActioned")} value={counts.actioned} icon={ShieldOff} color="destructive" />
        <AdminStatCard label={t("statDismissed")} value={counts.dismissed} icon={ShieldCheck} color="muted" />
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
          { value: "pending", label: t("status.pending") },
          { value: "actioned", label: t("status.actioned") },
          { value: "dismissed", label: t("status.dismissed") },
        ]}
      />

      <ModerationSuspectsPanel rows={rows} canManage={canManage} sortable={{ pathname: "/admin/moderation", sort, direction, query: { q, status, sort, direction } }} />

      <AdminPagination pathname="/admin/moderation" page={page} totalPages={totalPages} total={total} query={{ q, status, sort, direction }} label={`${total}`} />
    </div>
  );
}

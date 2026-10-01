/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShieldCheck, Clock, Undo2 } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { SanctionsPanel } from "@/components/admin/sanctions-panel";
import {
  listAdminSanctions,
  getAdminSanctionCounts,
  SANCTIONS_PAGE_SIZE,
  SANCTION_TYPES,
  type SanctionSort,
  type SanctionStatus,
  type SanctionType,
  type SortDirection,
} from "@/lib/admin-sanctions";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: SanctionSort[] = ["startsAt", "type", "status"];
const STATUS_VALUES: SanctionStatus[] = ["active", "expired", "revoked"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.sanctions" });
  return { title: t("title") };
}

export default async function AdminSanctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; status?: string; activeWithin?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.sanctionsView);
  const t = await getTranslations({ locale, namespace: "admin.sanctions" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as SanctionSort) : "startsAt";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const status = (STATUS_VALUES as string[]).includes(sp.status ?? "") ? (sp.status as SanctionStatus) : "";
  const type = (SANCTION_TYPES as readonly string[]).includes(sp.activeWithin ?? "") ? (sp.activeWithin as SanctionType) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, total }, counts] = await Promise.all([listAdminSanctions({ q, status, type, sort, direction, page }), getAdminSanctionCounts()]);
  const totalPages = Math.max(1, Math.ceil(total / SANCTIONS_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.sanctionsManage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminStatCard label={t("statActive")} value={counts.active} icon={ShieldCheck} color="destructive" />
        <AdminStatCard label={t("statExpired")} value={counts.expired} icon={Clock} color="muted" />
        <AdminStatCard label={t("statRevoked")} value={counts.revoked} icon={Undo2} color="sky" />
      </div>

      <AdminSearchSortBar
        searchPlaceholder={t("searchPlaceholder")}
        searchSubmitLabel={t("searchSubmit")}
        searchValue={q}
        sort={sort}
        direction={direction}
        activeWithinValue={type}
        activeWithinLabel={t("typeLabel")}
        activeWithinOptions={[{ value: "", label: t("typeAny") }, ...SANCTION_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))]}
        statusValue={status}
        statusLabel={t("statusLabel")}
        statusOptions={[
          { value: "", label: t("statusAny") },
          { value: "active", label: t("status.active") },
          { value: "expired", label: t("status.expired") },
          { value: "revoked", label: t("status.revoked") },
        ]}
      />

      <SanctionsPanel rows={rows} canManage={canManage} sortable={{ pathname: "/admin/sanctions", sort, direction, query: { q, status, activeWithin: type, sort, direction } }} />

      <AdminPagination pathname="/admin/sanctions" page={page} totalPages={totalPages} total={total} query={{ q, status, activeWithin: type, sort, direction }} label={`${total}`} />
    </div>
  );
}

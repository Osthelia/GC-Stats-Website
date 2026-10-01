/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Trophy, Radio, Clock, CheckCircle2 } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminColumnFilterBar, type AdminActiveFilter } from "@/components/admin/admin-column-filter-bar";
import { TournamentsPanel } from "@/components/admin/tournaments-panel";
import {
  listAdminTournaments,
  listPointTypeOptions,
  getAdminTournamentCounts,
  TOURNAMENTS_PAGE_SIZE,
  TOURNAMENT_FILTER_FIELDS,
  type TournamentSort,
  type SortDirection,
} from "@/lib/admin-tournaments";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: TournamentSort[] = ["name", "startDate", "status"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.tournaments" });
  return { title: t("title") };
}

export default async function AdminTournamentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.tournamentsView);
  const t = await getTranslations({ locale, namespace: "admin.tournaments" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as TournamentSort) : "startDate";
  const direction: SortDirection = sp.direction === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const filters: AdminActiveFilter[] = TOURNAMENT_FILTER_FIELDS.map((field) => ({ field, value: (sp[`f_${field}`] ?? "").trim() })).filter((f) => f.value !== "");
  const filterQuery = Object.fromEntries(filters.map((f) => [`f_${f.field}`, f.value]));

  const [{ rows: tournaments, total }, pointTypeOptions, counts] = await Promise.all([
    listAdminTournaments({ q, sort, direction, page, filters }),
    listPointTypeOptions(),
    getAdminTournamentCounts(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / TOURNAMENTS_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.tournamentsManage);

  const filterColumns = TOURNAMENT_FILTER_FIELDS.map((field) => ({ value: field, label: t(`columnFilter.${field}`) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminStatCard label={t("statTotal")} value={counts.total} icon={Trophy} color="amber" />
        <AdminStatCard label={t("status.live")} value={counts.live} icon={Radio} color="destructive" />
        <AdminStatCard label={t("status.upcoming")} value={counts.upcoming} icon={Clock} color="emerald" />
        <AdminStatCard label={t("status.finished")} value={counts.finished} icon={CheckCircle2} color="muted" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <AdminColumnFilterBar columns={filterColumns} activeFilters={filters} pathname="/admin/tournaments" baseQuery={{ q, sort, direction }} />
      </div>

      <TournamentsPanel
        tournaments={tournaments}
        canManage={canManage}
        pointTypeOptions={pointTypeOptions}
        sortable={{ pathname: "/admin/tournaments", sort, direction, query: { q, sort, direction, ...filterQuery } }}
      />

      <AdminPagination pathname="/admin/tournaments" page={page} totalPages={totalPages} total={total} query={{ q, sort, direction, ...filterQuery }} label={`${total}`} />
    </div>
  );
}

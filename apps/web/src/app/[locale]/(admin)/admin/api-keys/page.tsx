/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { KeyRound, Send, Timer, AlertTriangle } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import { listAdminApiKeys, getGlobalApiKeysOverview, API_KEYS_PAGE_SIZE, type ApiKeySort, type SortDirection } from "@/lib/admin-api-keys";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

const SORT_VALUES: ApiKeySort[] = ["clientName", "user", "status"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.apiKeys" });
  return { title: t("title") };
}

export default async function AdminApiKeysPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string; direction?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.apiKeysView);
  const t = await getTranslations({ locale, namespace: "admin.apiKeys" });

  const q = (sp.q ?? "").trim();
  const sort = (SORT_VALUES as string[]).includes(sp.sort ?? "") ? (sp.sort as ApiKeySort) : "clientName";
  const direction: SortDirection = sp.direction === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows: keys, total }, overview] = await Promise.all([listAdminApiKeys({ q, sort, direction, page }), getGlobalApiKeysOverview()]);
  const totalPages = Math.max(1, Math.ceil(total / API_KEYS_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.apiKeysManage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label={t("overviewActiveKeys")} value={overview.activeKeys} icon={KeyRound} color="sky" />
        <AdminStatCard label={t("overviewRequests")} value={overview.requestsThisMonth} icon={Send} color="violet" />
        <AdminStatCard label={t("overviewAvgResponse")} value={t("msValue", { value: overview.avgResponseMs })} icon={Timer} color="amber" />
        <AdminStatCard label={t("overviewErrorRate")} value={`${overview.errorRatePercent}%`} icon={AlertTriangle} color={overview.errorRatePercent > 0 ? "destructive" : "emerald"} />
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

      <ApiKeysPanel
        keys={keys}
        canManage={canManage}
        showUser
        sortable={{ pathname: "/admin/api-keys", sort, direction, query: { q, sort, direction } }}
        pagination={{ page, totalPages, total }}
      />
    </div>
  );
}

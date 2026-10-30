/**
 * GC-Stats - page
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, KeyRound, Send, Timer } from "lucide-react";
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { AdminSearchSortBar } from "@/components/admin/admin-search-sort-bar";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ApiKeysTabs } from "@/components/admin/api-keys-tabs";
import { PublicApiKeyActions } from "@/components/admin/public-api-key-actions";
import { PublicApiKeyStatusBadges } from "@/components/admin/public-api-key-status-badges";
import { FormattedDate } from "@/components/formatted-date";
import { getGlobalApiKeysOverview } from "@/lib/admin-api-keys";
import { listAdminPublicApiKeys, PUBLIC_API_KEY_STATUSES, PUBLIC_API_KEYS_PAGE_SIZE, type PublicApiKeyStatusFilter } from "@/lib/admin-public-api-keys";
import { getPublicApiConfig } from "@/lib/public-api/config";
import { hasAccess, requireAdminPermission } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.publicApiKeys" });
  return { title: t("title") };
}
export default async function AdminPublicApiKeysPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.apiKeysView);
  const t = await getTranslations({ locale, namespace: "admin.publicApiKeys" });
  const tKeys = await getTranslations({ locale, namespace: "admin.apiKeys" });
  const q = (sp.q ?? "").trim();
  const status = (PUBLIC_API_KEY_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as PublicApiKeyStatusFilter) : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [{ rows, total }, overview, config] = await Promise.all([listAdminPublicApiKeys({ q, status, page }), getGlobalApiKeysOverview("public"), getPublicApiConfig()]);
  const totalPages = Math.max(1, Math.ceil(total / PUBLIC_API_KEYS_PAGE_SIZE));
  const canManage = hasAccess(access, PERMISSIONS.apiKeysManage);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{tKeys("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle", { rate: config.ratePerSecond })}</p>
      </div>
      <ApiKeysTabs active="public" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label={tKeys("overviewActiveKeys")} value={overview.activeKeys} icon={KeyRound} color="sky" />
        <AdminStatCard label={tKeys("overviewRequests")} value={overview.requestsThisMonth} icon={Send} color="violet" />
        <AdminStatCard label={tKeys("overviewAvgResponse")} value={tKeys("msValue", { value: overview.avgResponseMs })} icon={Timer} color="amber" />
        <AdminStatCard label={tKeys("overviewErrorRate")} value={`${overview.errorRatePercent}%`} icon={AlertTriangle} color={overview.errorRatePercent > 0 ? "destructive" : "emerald"} />
      </div>
      <AdminSearchSortBar
        searchPlaceholder={t("searchPlaceholder")}
        searchSubmitLabel={tKeys("searchSubmit")}
        searchValue={q}
        sort=""
        direction=""
        activeWithinValue=""
        activeWithinLabel=""
        activeWithinOptions={[]}
        statusValue={status ?? ""}
        statusLabel={t("statusFilter")}
        statusOptions={PUBLIC_API_KEY_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
      />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/api-keys/${key.id}`} className="text-lg font-semibold transition-colors hover:underline active:opacity-70">
                        {key.clientName}
                      </Link>
                      <PublicApiKeyStatusBadges apiKey={key} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {key.userId ? (
                        <Link href={`/admin/users/${key.userId}`} className="font-medium text-foreground transition-colors hover:underline active:opacity-70">
                          {key.username ?? key.email ?? key.userId}
                        </Link>
                      ) : (
                        "-"
                      )}{" "}
                      · <span className="font-mono text-xs">{key.keyHashPreview}…</span> · <FormattedDate date={key.createdAt} mode="date" /> · {t("requests30d", { count: key.requests30d })}
                    </p>
                  </div>
                </div>
                <p className="rounded-md border bg-muted/40 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">{key.usageDescription || "-"}</p>
                <PublicApiKeyActions apiKey={key} canManage={canManage} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AdminPagination pathname="/admin/api-keys/public" page={page} totalPages={totalPages} total={total} query={{ q, ...(status ? { status } : {}) }} label={`${total}`} />
    </div>
  );
}

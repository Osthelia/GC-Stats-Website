/**
 * GC-Stats — page
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Activity, Clock, Gauge, TrendingUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { ApiKeyDailyChart } from "@/components/dashboard/api-key-daily-chart";
import { ApiKeyEndpointsTable } from "@/components/dashboard/api-key-endpoints-table";
import { requireDashboardOrgAccess } from "@/lib/dashboard-rbac";
import { getAdminOrganization } from "@/lib/admin-organizations";
import { getOrganizationApiKey, getApiKeyStats } from "@/lib/dashboard-api-keys";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.apiKeyStats" });
  return { title: t("title") };
}

export default async function DashboardApiKeyStatsPage({ params }: { params: Promise<{ locale: string; organizationId: string; apiKeyId: string }> }) {
  const { locale, organizationId, apiKeyId } = await params;
  const orgId = parseEntityId(organizationId);
  const keyId = parseEntityId(apiKeyId);
  if (orgId === null || keyId === null) notFound();

  await requireDashboardOrgAccess(locale as AppLocale, orgId);
  const [organization, key] = await Promise.all([getAdminOrganization(orgId), getOrganizationApiKey(orgId, keyId)]);
  if (!organization || !key) notFound();

  const stats = await getApiKeyStats(keyId);
  const t = await getTranslations({ locale, namespace: "dashboard.apiKeyStats" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/dashboard/${orgId}/api-keys`} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t("backToKeys")}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{key.clientName}</h1>
          <ActiveStatusBadge active={key.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
        </div>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DashboardStatCard label={t("volume24h")} value={stats.volume.day} icon={Activity} color="sky" />
        <DashboardStatCard label={t("volume7d")} value={stats.volume.week} icon={TrendingUp} color="violet" />
        <DashboardStatCard label={t("volume30d")} value={stats.volume.month} icon={Gauge} color="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("latencyHeading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {(["min", "p50", "p95", "p99", "max"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground uppercase">{t(`latency.${k}`)}</span>
                <span className="text-lg font-semibold tabular-nums">{t("msValue", { value: stats.latency[k] })}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <CardTitle>{t("chartHeading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyDailyChart labels={stats.daily.labels} requests={stats.daily.requests} errors={stats.daily.errors} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("endpointsHeading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyEndpointsTable endpoints={stats.endpoints} />
        </CardContent>
      </Card>
    </div>
  );
}

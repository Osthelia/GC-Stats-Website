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
import { KeyRound, Send, Timer, AlertTriangle } from "lucide-react";
import { ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgAccess, hasOrgPermission } from "@/lib/dashboard-rbac";
import { getAdminOrganization } from "@/lib/admin-organizations";
import { listOrganizationApiKeys, getOrganizationApiKeysOverview } from "@/lib/dashboard-api-keys";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { regenerateOrganizationApiKey } from "@/actions/dashboard-api-keys";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { DashboardInfoBar } from "@/components/dashboard/dashboard-info-bar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.apiKeys" });
  return { title: t("title") };
}

export default async function DashboardOrganizationApiKeysPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  const t = await getTranslations({ locale, namespace: "dashboard.apiKeys" });
  const canManage = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.apiKeysManage);

  if (!canManage) {
    const organization = await getAdminOrganization(id);
    if (!organization) notFound();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("readOnlyHint")}</p>
      </div>
    );
  }

  const [organization, keys, overview] = await Promise.all([getAdminOrganization(id), listOrganizationApiKeys(id), getOrganizationApiKeysOverview(id)]);
  if (!organization) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard label={t("overviewActiveKeys")} value={overview.activeKeys} icon={KeyRound} color="sky" />
        <DashboardStatCard label={t("overviewRequests")} value={overview.requestsThisMonth} icon={Send} color="violet" />
        <DashboardStatCard label={t("overviewAvgResponse")} value={t("msValue", { value: overview.avgResponseMs })} icon={Timer} color="amber" />
        <DashboardStatCard label={t("overviewErrorRate")} value={`${overview.errorRatePercent}%`} icon={AlertTriangle} color={overview.errorRatePercent > 0 ? "destructive" : "emerald"} />
      </div>

      <DashboardInfoBar>{t("createHint")}</DashboardInfoBar>

      <ApiKeysPanel keys={keys} canManage={canManage} statsBasePath={`/dashboard/${id}/api-keys`} onRegenerate={regenerateOrganizationApiKey.bind(null, id)} />
    </div>
  );
}

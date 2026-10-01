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
import { requireApiKeyAccess } from "@/lib/dashboard-rbac";
import { listPersonalApiKeys, getPersonalApiKeysOverview } from "@/lib/dashboard-personal-api-keys";
import { regeneratePersonalApiKey } from "@/actions/dashboard-personal-api-keys";
import type { AppLocale } from "@/i18n/routing";
import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { DashboardInfoBar } from "@/components/dashboard/dashboard-info-bar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.myApiKeys" });
  return { title: t("title") };
}

export default async function DashboardPersonalApiKeysPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { userId } = await requireApiKeyAccess(locale as AppLocale);
  const t = await getTranslations({ locale, namespace: "dashboard.myApiKeys" });
  const tShared = await getTranslations({ locale, namespace: "dashboard.apiKeys" });

  const [keys, overview] = await Promise.all([listPersonalApiKeys(userId), getPersonalApiKeysOverview(userId)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard label={tShared("overviewActiveKeys")} value={overview.activeKeys} icon={KeyRound} color="sky" />
        <DashboardStatCard label={tShared("overviewRequests")} value={overview.requestsThisMonth} icon={Send} color="violet" />
        <DashboardStatCard label={tShared("overviewAvgResponse")} value={tShared("msValue", { value: overview.avgResponseMs })} icon={Timer} color="amber" />
        <DashboardStatCard
          label={tShared("overviewErrorRate")}
          value={`${overview.errorRatePercent}%`}
          icon={AlertTriangle}
          color={overview.errorRatePercent > 0 ? "destructive" : "emerald"}
        />
      </div>

      <DashboardInfoBar>{t("createHint")}</DashboardInfoBar>

      <ApiKeysPanel keys={keys} canManage statsBasePath="/dashboard/api-keys" onRegenerate={regeneratePersonalApiKey} />
    </div>
  );
}

/**
 * GC-Stats - page
 *
 * Webhooks of the personal partner API keys.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardWebhooksPage } from "@/components/dashboard/webhooks-page";
import { requireApiKeyAccess } from "@/lib/dashboard-rbac";
import { listPersonalApiKeys } from "@/lib/dashboard-personal-api-keys";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.webhooks" });
  return { title: t("pageTitle") };
}

export default async function DashboardPersonalWebhooksPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ key?: string }> }) {
  const [{ locale }, { key }] = await Promise.all([params, searchParams]);
  const { userId } = await requireApiKeyAccess(locale as AppLocale);
  const keys = await listPersonalApiKeys(userId);

  return <DashboardWebhooksPage locale={locale} keys={keys} requestedKey={key} basePath="/dashboard/api-keys/webhooks" organizationId={null} />;
}

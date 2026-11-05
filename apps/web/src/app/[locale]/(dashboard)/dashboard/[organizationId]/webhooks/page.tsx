/**
 * GC-Stats - page
 *
 * Webhooks of the organization partner API keys.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { DashboardWebhooksPage } from "@/components/dashboard/webhooks-page";
import { hasOrgPermission, requireDashboardOrgAccess } from "@/lib/dashboard-rbac";
import { listOrganizationApiKeys } from "@/lib/dashboard-api-keys";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.webhooks" });
  return { title: t("pageTitle") };
}

export default async function DashboardOrganizationWebhooksPage({ params, searchParams }: { params: Promise<{ locale: string; organizationId: string }>; searchParams: Promise<{ key?: string }> }) {
  const [{ locale, organizationId }, { key }] = await Promise.all([params, searchParams]);
  const orgId = parseEntityId(organizationId);
  if (orgId === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, orgId);
  if (!hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.apiKeysManage)) notFound();
  const keys = await listOrganizationApiKeys(orgId);

  return <DashboardWebhooksPage locale={locale} keys={keys} requestedKey={key} basePath={`/dashboard/${orgId}/webhooks`} organizationId={orgId} />;
}

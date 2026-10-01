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
import { ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgAccess, hasOrgPermission } from "@/lib/dashboard-rbac";
import { getAdminOrganization } from "@/lib/admin-organizations";
import { listOrganizationVodRows } from "@/lib/dashboard-vods-data";
import { listActiveNewsLanguages } from "@/lib/news-languages";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { OrgVodsPanel } from "@/components/dashboard/org-vods-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.vods" });
  return { title: t("title") };
}

export default async function DashboardOrganizationVodsPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  const [organization, vods, languages] = await Promise.all([getAdminOrganization(id), listOrganizationVodRows(id), listActiveNewsLanguages()]);
  if (!organization) notFound();

  const t = await getTranslations({ locale, namespace: "dashboard.vods" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <OrgVodsPanel organizationId={id} initialVods={vods} languages={languages} canManage={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.vodsLink)} />
    </div>
  );
}

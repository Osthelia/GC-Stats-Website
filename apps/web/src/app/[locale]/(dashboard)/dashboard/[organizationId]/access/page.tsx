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
import { listOrganizationAccess } from "@/lib/organization-access-data";
import { listOrganizationRoles } from "@/lib/organization-roles-data";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { OrgAccessPanel } from "@/components/dashboard/org-access-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.access" });
  return { title: t("title") };
}

export default async function DashboardOrganizationAccessPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  const [organization, grants, roles] = await Promise.all([getAdminOrganization(id), listOrganizationAccess(id), listOrganizationRoles(id)]);
  if (!organization) notFound();

  const t = await getTranslations({ locale, namespace: "dashboard.access" });
  // Email is never surfaced on the dashboard, only in /admin, so it's stripped before reaching the client payload.
  const safeGrants = grants.map(({ email: _email, ...grant }) => grant);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <OrgAccessPanel
        organizationId={id}
        initialGrants={safeGrants}
        roles={roles}
        canManage={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.membersManage)}
        canGrantOwner={membership.isOwner}
      />
    </div>
  );
}

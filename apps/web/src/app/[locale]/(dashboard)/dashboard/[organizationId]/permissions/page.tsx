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
import { requireDashboardOrgAccess } from "@/lib/dashboard-rbac";
import { getAdminOrganization } from "@/lib/admin-organizations";
import { listOrganizationRolesWithPermissions, listOrganizationMemberRoleLinks, listOrganizationRoles } from "@/lib/organization-roles-data";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { OrgRoleManager } from "@/components/dashboard/org-role-manager";
import { OrgMemberRoleLinksPanel } from "@/components/dashboard/org-member-role-links-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.permissions" });
  return { title: t("title") };
}

export default async function DashboardOrganizationPermissionsPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  // Owner-only, same rationale as /admin/roles being super-admin-only,
  // see requireDashboardOrgOwnerActor in lib/dashboard-rbac.ts.
  if (!membership.isOwner) redirect({ href: `/dashboard/${id}`, locale: locale as AppLocale });

  const organization = await getAdminOrganization(id);
  if (!organization) notFound();

  const [t, roles, roleSummaries, memberRoleLinks] = await Promise.all([
    getTranslations({ locale, namespace: "dashboard.permissions" }),
    listOrganizationRolesWithPermissions(id),
    listOrganizationRoles(id),
    listOrganizationMemberRoleLinks(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <OrgRoleManager organizationId={id} maxPermissions={organization.maxPermissions} initialRoles={roles} />
      <OrgMemberRoleLinksPanel organizationId={id} roles={roleSummaries} initialLinks={memberRoleLinks} />
    </div>
  );
}

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
import { getAdminOrganization, getAdminOrganizationMembers } from "@/lib/admin-organizations";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { OrgMembersPanel } from "@/components/dashboard/org-members-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.members" });
  return { title: t("title") };
}

export default async function DashboardOrganizationMembersPage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  const [organization, members] = await Promise.all([getAdminOrganization(id), getAdminOrganizationMembers(id)]);
  if (!organization) notFound();

  const t = await getTranslations({ locale, namespace: "dashboard.members" });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <OrgMembersPanel
        organizationId={id}
        initialMembers={members}
        canManage={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.staffManage)}
        canCreatePerson={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.peopleCreate)}
        canLinkUser={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.peopleLinkUser)}
        canEditProfile={hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.peopleEditProfile)}
      />
    </div>
  );
}

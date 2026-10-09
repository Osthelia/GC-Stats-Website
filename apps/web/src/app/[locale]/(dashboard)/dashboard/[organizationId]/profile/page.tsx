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
import { getEntityLogos } from "@/lib/admin-logos";
import { parseEntityId } from "@/lib/entity-id";
import type { AppLocale } from "@/i18n/routing";
import { OrgProfileForm } from "@/components/dashboard/org-profile-form";
import { DashboardLogoPanel } from "@/components/dashboard/dashboard-logo-panel";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard.profile" });
  return { title: t("title") };
}

export default async function DashboardOrganizationProfilePage({ params }: { params: Promise<{ locale: string; organizationId: string }> }) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const { membership } = await requireDashboardOrgAccess(locale as AppLocale, id);
  if (membership.isTeamLinked) notFound();
  const [organization, logos] = await Promise.all([getAdminOrganization(id), getEntityLogos("organization", id)]);
  if (!organization) notFound();

  const t = await getTranslations({ locale, namespace: "dashboard.profile" });
  const canEditProfile = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.profileEdit);
  const canUploadLogo = hasOrgPermission(membership, ORGANIZATION_PERMISSIONS.logoUpload);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <DashboardLogoPanel organizationId={id} displayName={organization.name} entries={logos} canEdit={canUploadLogo} />
      <OrgProfileForm organization={organization} canEdit={canEditProfile} />
    </div>
  );
}

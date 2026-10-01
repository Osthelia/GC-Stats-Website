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
import { PERMISSIONS } from "@gc-stats/db";
import { Link } from "@/i18n/navigation";
import { getAdminOrganization, getAdminOrganizationMembers } from "@/lib/admin-organizations";
import { listOrganizationAccess } from "@/lib/organization-access-data";
import { listOrganizationRoles } from "@/lib/organization-roles-data";
import { getEntityLogos } from "@/lib/admin-logos";
import { parseEntityId } from "@/lib/entity-id";
import { requireAdminPermission, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { OrganizationEditForm } from "@/components/admin/organization-edit-form";
import { OrganizationMembersPanel } from "@/components/admin/organization-members-panel";
import { OrganizationAccessPanel } from "@/components/admin/organization-access-panel";
import { OrganizationDashboardAccessPanel } from "@/components/admin/organization-dashboard-access-panel";
import { EntityLogoPanel } from "@/components/admin/entity-logo-panel";
import { OrganizationDeleteButton } from "@/components/admin/organization-delete-button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; organizationId: string }> }): Promise<Metadata> {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  const organization = id === null ? null : await getAdminOrganization(id);
  if (organization) return { title: organization.name };
  const t = await getTranslations({ locale, namespace: "admin.organizations" });
  return { title: t("title") };
}

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
}) {
  const { locale, organizationId } = await params;
  const id = parseEntityId(organizationId);
  if (id === null) notFound();

  const access = await requireAdminPermission(locale as AppLocale, PERMISSIONS.organizationsView);
  const t = await getTranslations({ locale, namespace: "admin.organizations.edit" });
  const [organization, members, accessGrants, roles, logos] = await Promise.all([
    getAdminOrganization(id),
    getAdminOrganizationMembers(id),
    listOrganizationAccess(id),
    listOrganizationRoles(id),
    getEntityLogos("organization", id),
  ]);
  if (!organization) notFound();

  const canEditProfile = hasAccess(access, PERMISSIONS.organizationsEdit);
  const canManageAccess = hasAccess(access, PERMISSIONS.organizationsManageAccess);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/organizations" className="text-sm text-muted-foreground hover:text-foreground">
            {t("backToList")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{organization.name}</h1>
        </div>
        {hasAccess(access, PERMISSIONS.organizationsDelete) && <OrganizationDeleteButton organizationId={organization.id} organizationName={organization.name} />}
      </div>

      <OrganizationEditForm
        organization={organization}
        rightExtra={
          <EntityLogoPanel
            namespace="admin.organizations.edit"
            entityType="organization"
            entityId={organization.id}
            displayName={organization.name}
            entries={logos}
            canEdit={canEditProfile}
          />
        }
      />

      <OrganizationAccessPanel organizationId={organization.id} initialMaxPermissions={organization.maxPermissions} canManage={canManageAccess} />

      <OrganizationDashboardAccessPanel organizationId={organization.id} initialGrants={accessGrants} roles={roles} canManage={canManageAccess} />

      <OrganizationMembersPanel organizationId={organization.id} initialMembers={members} canManage={canManageAccess} />
    </div>
  );
}

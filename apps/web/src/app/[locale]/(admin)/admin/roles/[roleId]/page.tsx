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
import { Link, redirect } from "@/i18n/navigation";
import { getGlobalRoleDetail } from "@/lib/admin-roles";
import { requireAdminAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";
import { RoleRenameForm } from "@/components/admin/role-rename-form";
import { RolePermissionsForm } from "@/components/admin/role-permissions-form";
import { RoleMembersPanel } from "@/components/admin/role-members-panel";
import { RoleDeleteButton } from "@/components/admin/role-delete-button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; roleId: string }> }): Promise<Metadata> {
  const { locale, roleId } = await params;
  const id = Number(roleId);
  const role = Number.isInteger(id) && id > 0 ? await getGlobalRoleDetail(id) : null;
  if (role) return { title: role.name };
  const t = await getTranslations({ locale, namespace: "admin.roles" });
  return { title: t("title") };
}

export default async function AdminRolePage({
  params,
}: {
  params: Promise<{ locale: string; roleId: string }>;
}) {
  const { locale, roleId } = await params;
  const id = Number(roleId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const access = await requireAdminAccess(locale as AppLocale);
  if (!access.isSuperAdmin) redirect({ href: "/admin", locale: locale as AppLocale });

  const t = await getTranslations({ locale, namespace: "admin.roles" });
  const role = await getGlobalRoleDetail(id);
  if (!role) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/roles" className="text-sm text-muted-foreground hover:text-foreground">
            {t("backToList")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{role.name}</h1>
        </div>
        {!role.isSuperAdmin && <RoleDeleteButton roleId={role.id} roleName={role.name} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <RoleRenameForm roleId={role.id} initialName={role.name} />
          <RoleMembersPanel roleId={role.id} initialMembers={role.members} />
        </div>
        <RolePermissionsForm roleId={role.id} isSuperAdmin={role.isSuperAdmin} initialPermissions={role.permissionNames} />
      </div>
    </div>
  );
}

/**
 * GC-Stats - organization-roles-data
 *
 * Reads for an organization's custom access roles, their permissions, and
 * their opt-in links to member roles (auto-grant config).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizationRoles, organizationRolePermissions, organizationMemberRoleLinks } from "@gc-stats/db";

export type OrganizationRoleSummary = { id: number; name: string };
export type OrganizationRoleWithPermissions = OrganizationRoleSummary & { permissions: string[] };

/** Every custom role for this organization ('owner' is never a row here — it's an immutable sentinel, see dashboard-rbac.ts) — used to populate role pickers in both /admin and /dashboard access panels. */
export async function listOrganizationRoles(organizationId: number): Promise<OrganizationRoleSummary[]> {
  return db
    .select({ id: organizationRoles.id, name: organizationRoles.name })
    .from(organizationRoles)
    .where(eq(organizationRoles.organizationId, organizationId))
    .orderBy(organizationRoles.name);
}

/** Same as listOrganizationRoles, plus each role's own permission set — feeds the /dashboard/{id}/permissions role manager. */
export async function listOrganizationRolesWithPermissions(organizationId: number): Promise<OrganizationRoleWithPermissions[]> {
  const roles = await listOrganizationRoles(organizationId);
  if (roles.length === 0) return [];

  const permRows = await db
    .select({ roleId: organizationRolePermissions.roleId, permission: organizationRolePermissions.permission })
    .from(organizationRolePermissions)
    .where(inArray(organizationRolePermissions.roleId, roles.map((r) => r.id)));

  return roles.map((role) => ({ ...role, permissions: permRows.filter((p) => p.roleId === role.id).map((p) => p.permission) }));
}

export type OrganizationMemberRoleLink = { memberRole: string; permissionRoleId: number | null };

/** Every opted-in member-role -> access-role link for this organization — feeds the auto-grant config panel on /dashboard/{id}/permissions, see organization_member_role_links' schema comment. */
export async function listOrganizationMemberRoleLinks(organizationId: number): Promise<OrganizationMemberRoleLink[]> {
  return db
    .select({ memberRole: organizationMemberRoleLinks.memberRole, permissionRoleId: organizationMemberRoleLinks.permissionRoleId })
    .from(organizationMemberRoleLinks)
    .where(eq(organizationMemberRoleLinks.organizationId, organizationId));
}

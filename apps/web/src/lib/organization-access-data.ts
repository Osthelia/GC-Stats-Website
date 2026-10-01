/**
 * GC-Stats - organization-access-data
 *
 * Reads for organization_access (dashboard access grants), not the public
 * organization_memberships roster. Shared by /admin/organizations/[id] and
 * /dashboard/[id]/access, each gated differently.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizationAccess, organizationAccessRoles, organizationRoles, users } from "@gc-stats/db";

export type OrganizationAccessGrant = {
  accessId: number;
  userId: string;
  username: string | null;
  email: string | null;
  image: string | null;
  isOwner: boolean;
  /** A non-owner grant can hold several roles at once (permissions = union) — always empty for an owner grant. */
  roleIds: number[];
  roleNames: string[];
};

/** Every user with organization_access to this organization — this is dashboard access, NOT the public "members" credit roster (organization_memberships, see lib/admin-organizations.ts). Shared by /admin/organizations/[id] and /dashboard/[id]/access, gated differently by each caller. */
export async function listOrganizationAccess(organizationId: number): Promise<OrganizationAccessGrant[]> {
  const grants = await db
    .select({
      accessId: organizationAccess.id,
      userId: users.id,
      username: users.username,
      email: users.email,
      image: users.image,
      isOwner: organizationAccess.isOwner,
    })
    .from(organizationAccess)
    .innerJoin(users, eq(users.id, organizationAccess.userId))
    .where(eq(organizationAccess.organizationId, organizationId))
    .orderBy(users.username);
  if (grants.length === 0) return [];

  const roleRows = await db
    .select({ accessId: organizationAccessRoles.accessId, roleId: organizationAccessRoles.roleId, roleName: organizationRoles.name })
    .from(organizationAccessRoles)
    .innerJoin(organizationRoles, eq(organizationRoles.id, organizationAccessRoles.roleId))
    .where(inArray(organizationAccessRoles.accessId, grants.map((g) => g.accessId)));

  return grants.map((g) => {
    const myRoles = roleRows.filter((r) => r.accessId === g.accessId);
    return { ...g, roleIds: myRoles.map((r) => r.roleId), roleNames: myRoles.map((r) => r.roleName) };
  });
}

export async function getOrganizationAccessCount(organizationId: number): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(organizationAccess)
    .where(eq(organizationAccess.organizationId, organizationId));
  return Number(rows[0]?.total ?? 0);
}

/**
 * GC-Stats - admin-roles
 *
 * Admin queries for /admin/roles: global-scope role list with member and
 * permission counts, plus per-role detail (permissions and members).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, count, eq, isNull, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { roles, rolePermissions, permissions, userRoles, users } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export type AdminRoleRow = {
  id: number;
  name: string;
  isSuperAdmin: boolean;
  memberCount: number;
  permissionCount: number;
};

export type AdminRoleSort = "name" | "memberCount" | "permissionCount";
export type SortDirection = "asc" | "desc";

export const ROLES_PAGE_SIZE = 30;

/** Global-scope roles only — /admin/roles never touches this `roles` table's 'team'/'publisher' scopeType values. /dashboard's org-level permissions don't use this table at all, see lib/dashboard-rbac.ts. */
export async function listGlobalRolesWithCounts(opts: { q: string; sort: AdminRoleSort; direction: SortDirection; page: number }): Promise<{ rows: AdminRoleRow[]; total: number }> {
  const { q, sort, direction, page } = opts;

  const conditions = [eq(roles.scopeType, "global")];
  if (q) {
    const variants = typoVariants(q.toLowerCase());
    conditions.push(or(...variants.map((v) => foldedIlike(roles.name, v)))!);
  }
  const where = and(...conditions);

  const permCounts = db
    .select({ roleId: rolePermissions.roleId, permissionCount: count(rolePermissions.permissionId).as("permission_count") })
    .from(rolePermissions)
    .groupBy(rolePermissions.roleId)
    .as("perm_counts");

  const memberCount = count(userRoles.id);
  const permissionCount = sql<number>`coalesce(${permCounts.permissionCount}, 0)`;
  const sortCol = sort === "memberCount" ? memberCount : sort === "permissionCount" ? permissionCount : roles.name;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: roles.id,
        name: roles.name,
        isSuperAdmin: roles.isSuperAdmin,
        memberCount,
        permissionCount,
      })
      .from(roles)
      .leftJoin(userRoles, and(eq(userRoles.roleId, roles.id), isNull(userRoles.scopeId)))
      .leftJoin(permCounts, eq(permCounts.roleId, roles.id))
      .where(where)
      .groupBy(roles.id, permCounts.permissionCount)
      .orderBy(orderBy, asc(roles.name))
      .limit(ROLES_PAGE_SIZE)
      .offset((page - 1) * ROLES_PAGE_SIZE),
    db.select({ total: count(roles.id) }).from(roles).where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, permissionCount: Number(r.permissionCount) })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export type AdminRoleMember = { id: string; username: string | null; email: string | null; image: string | null };

export type AdminRoleDetail = {
  id: number;
  name: string;
  isSuperAdmin: boolean;
  permissionNames: string[];
  members: AdminRoleMember[];
};

export async function getGlobalRoleDetail(roleId: number): Promise<AdminRoleDetail | null> {
  const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.scopeType, "global")));
  if (!role) return null;

  const [permissionRows, memberRows] = await Promise.all([
    db
      .select({ name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, roleId)),
    db
      .select({ id: users.id, username: users.username, email: users.email, image: users.image })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(userRoles.roleId, roleId), isNull(userRoles.scopeId)))
      .orderBy(users.username),
  ]);

  return {
    id: role.id,
    name: role.name,
    isSuperAdmin: role.isSuperAdmin,
    permissionNames: permissionRows.map((p) => p.name),
    members: memberRows,
  };
}

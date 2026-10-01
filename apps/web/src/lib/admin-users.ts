/**
 * GC-Stats - admin-users
 *
 * Admin queries for /admin/users: paginated, searchable user list with
 * global roles, and global role lookups for the role picker.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, roles, userRoles } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export type AdminUserRole = { id: number; name: string; isSuperAdmin: boolean };

export type AdminUserSort = "username" | "email" | "createdAt" | "lastLoginAt";
export type SortDirection = "asc" | "desc";

export type AdminUserRow = {
  id: string;
  username: string | null;
  email: string | null;
  image: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  roles: AdminUserRole[];
};

/** All global-scope roles, for the role picker — team/publisher-scoped roles aren't editable from /admin/users. */
export async function listGlobalRoles(): Promise<AdminUserRole[]> {
  const rows = await db
    .select({ id: roles.id, name: roles.name, isSuperAdmin: roles.isSuperAdmin })
    .from(roles)
    .where(eq(roles.scopeType, "global"))
    .orderBy(roles.name);
  return rows;
}

export const USERS_PAGE_SIZE = 30;

// Roles are fetched in a second pass keyed on this page's user ids — the role join
// produces one row per role, so paginating the joined query directly would cut a
// user's roles off (or return fewer than PAGE_SIZE distinct users) at the boundary.
export async function listAdminUsers(opts: { q: string; sort: AdminUserSort; direction: SortDirection; page: number }): Promise<{ rows: AdminUserRow[]; total: number }> {
  const { q, sort, direction, page } = opts;

  let where;
  if (q) {
    const variants = typoVariants(q.toLowerCase());
    const clauses = variants.flatMap((v) => [foldedIlike(users.username, v), foldedIlike(users.email, v)]);
    where = or(...clauses);
  }

  const sortCol = sort === "username" ? users.username : sort === "email" ? users.email : sort === "lastLoginAt" ? users.lastLoginAt : users.createdAt;
  const orderBy = direction === "asc" ? asc(sortCol) : desc(sortCol);

  const [userRows, totalRows] = await Promise.all([
    db
      .select({ id: users.id, username: users.username, email: users.email, image: users.image, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(where)
      .orderBy(orderBy)
      .limit(USERS_PAGE_SIZE)
      .offset((page - 1) * USERS_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(users).where(where),
  ]);

  const byUser = new Map<string, AdminUserRow>(userRows.map((r) => [r.id, { ...r, roles: [] }]));

  if (byUser.size > 0) {
    const roleRows = await db
      .select({ userId: userRoles.userId, roleId: roles.id, roleName: roles.name, roleIsSuperAdmin: roles.isSuperAdmin })
      .from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.scopeType, "global")))
      .where(and(inArray(userRoles.userId, [...byUser.keys()]), isNull(userRoles.scopeId)))
      .orderBy(asc(roles.name));

    for (const row of roleRows) {
      byUser.get(row.userId)?.roles.push({ id: row.roleId, name: row.roleName, isSuperAdmin: row.roleIsSuperAdmin });
    }
  }

  return { rows: [...byUser.values()], total: Number(totalRows[0]?.total ?? 0) };
}

export async function getUserGlobalRoleIds(userId: string): Promise<number[]> {
  const rows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(roles.scopeType, "global"), isNull(userRoles.scopeId)));
  return rows.map((r) => r.roleId);
}

/**
 * GC-Stats - admin-roles
 *
 * Super admin only server actions for role/permission management. Not
 * gated by a regular permission on purpose, so no role can grant itself or
 * another role the means to escalate.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { roles, permissions, rolePermissions, userRoles, users, ALL_PERMISSIONS } from "@gc-stats/db";
import { ADMIN_ACCESS_PERMISSION, requireSuperAdminActor } from "@/lib/rbac";

// Everything in this file is super-admin-only (see requireSuperAdminActor) —
// role/permission management is deliberately NOT gated by a regular
// permission, so no role can grant itself (or any other role) the means to
// escalate. Mirrors V1's super-admin-only 'manage-roles' Gate. See
// packages/db/src/permissions.ts for the full rationale.

export type ActionResult = { ok: true } | { ok: false; error: string };
export type RoleNameResult = { ok: true; roleId: number } | { ok: false; error: string };

const MAX_NAME_LENGTH = 100;

async function validateRoleName(name: string, excludeRoleId?: number): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "nameRequired" };
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, error: "nameTooLong" };

  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        eq(roles.scopeType, "global"),
        eq(roles.name, trimmed),
        excludeRoleId !== undefined ? ne(roles.id, excludeRoleId) : undefined
      )
    );
  if (existing.length > 0) return { ok: false, error: "nameTaken" };

  return { ok: true, name: trimmed };
}

export async function createRole(name: string): Promise<RoleNameResult> {
  await requireSuperAdminActor();

  const validated = await validateRoleName(name);
  if (!validated.ok) return validated;

  const [role] = await db.insert(roles).values({ name: validated.name, scopeType: "global", isSuperAdmin: false }).returning();
  return { ok: true, roleId: role!.id };
}

export async function renameRole(roleId: number, name: string): Promise<ActionResult> {
  await requireSuperAdminActor();

  const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.scopeType, "global")));
  if (!role) return { ok: false, error: "roleNotFound" };

  const validated = await validateRoleName(name, roleId);
  if (!validated.ok) return validated;

  await db.update(roles).set({ name: validated.name }).where(eq(roles.id, roleId));
  return { ok: true };
}

export async function deleteRole(roleId: number): Promise<ActionResult> {
  await requireSuperAdminActor();

  const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.scopeType, "global")));
  if (!role) return { ok: false, error: "roleNotFound" };
  if (role.isSuperAdmin) return { ok: false, error: "protectedRole" };

  await db.delete(roles).where(eq(roles.id, roleId));
  return { ok: true };
}

export async function updateRolePermissions(roleId: number, permissionNames: string[]): Promise<ActionResult> {
  await requireSuperAdminActor();

  const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.scopeType, "global")));
  if (!role) return { ok: false, error: "roleNotFound" };
  if (role.isSuperAdmin) return { ok: false, error: "protectedRole" };

  const uniqueNames = [...new Set(permissionNames)];
  if (uniqueNames.some((name) => !(ALL_PERMISSIONS as string[]).includes(name))) {
    return { ok: false, error: "permissionNotFound" };
  }

  const permissionRows = uniqueNames.length
    ? await db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.name, uniqueNames))
    : [];
  if (permissionRows.length !== uniqueNames.length) return { ok: false, error: "permissionNotFound" };

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissionRows.length) {
      await tx.insert(rolePermissions).values(permissionRows.map((p) => ({ roleId, permissionId: p.id })));
    }
  });

  return { ok: true };
}

export async function addRoleMember(roleId: number, userId: string): Promise<ActionResult> {
  await requireSuperAdminActor();

  const [role] = await db.select({ id: roles.id }).from(roles).where(and(eq(roles.id, roleId), eq(roles.scopeType, "global")));
  if (!role) return { ok: false, error: "roleNotFound" };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!user) return { ok: false, error: "userNotFound" };

  await db.insert(userRoles).values({ userId, roleId, scopeId: null }).onConflictDoNothing();
  return { ok: true };
}

export async function removeRoleMember(roleId: number, userId: string): Promise<ActionResult> {
  const actor = await requireSuperAdminActor();

  const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.scopeType, "global")));
  if (!role) return { ok: false, error: "roleNotFound" };

  if (userId === actor.userId) {
    const remainingRoleIds = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), isNull(userRoles.scopeId), ne(userRoles.roleId, roleId)));
    const stillHasAdminAccess = await roleSetGrantsAdminAccess(remainingRoleIds.map((r) => r.roleId));
    if (!stillHasAdminAccess) return { ok: false, error: "selfDemote" };
  }

  await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), isNull(userRoles.scopeId)));
  return { ok: true };
}

async function roleSetGrantsAdminAccess(roleIds: number[]): Promise<boolean> {
  if (roleIds.length === 0) return false;
  const rows = await db
    .select({ isSuperAdmin: roles.isSuperAdmin, permissionName: permissions.name })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(inArray(roles.id, roleIds));
  return rows.some((r) => r.isSuperAdmin || r.permissionName === ADMIN_ACCESS_PERMISSION);
}

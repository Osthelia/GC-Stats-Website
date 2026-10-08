/**
 * GC-Stats - admin-users
 *
 * Super admin only server action for assigning global roles to a user.
 * Role assignment is an escalation vector, so it stays gated the same way
 * as /admin/roles rather than by a regular permission.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, roles, userRoles, permissions, rolePermissions } from "@gc-stats/db";
import { ADMIN_ACCESS_PERMISSION, requireSuperAdminActor } from "@/lib/rbac";
import { diffChanges } from "@/lib/activity-log";
import { logAccountActivity } from "@/lib/account-activity-log";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Replaces a user's global-scope role assignments. Super-admin-only, not
 * gated by a regular permission — assigning roles (including Super Admin
 * itself) is an escalation vector, so it gets the same protection as
 * /admin/roles (see requireSuperAdminActor). Mirrors V1, where role
 * assignment lived exclusively on Admin\RoleController behind the
 * super-admin-only 'manage-roles' gate, never on the users list.
 *
 * Re-validates everything server-side (target user exists, every roleId is
 * a real global role) even though the dialog only lets you pick from a
 * fetched list — the list can go stale between page load and submit.
 */
export async function updateUserGlobalRoles(targetUserId: string, roleIds: number[]): Promise<ActionResult> {
  const actorId = (await requireSuperAdminActor()).userId;

  const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!targetUser) return { ok: false, error: "userNotFound" };

  const uniqueRoleIds = [...new Set(roleIds)];
  const validRoles = uniqueRoleIds.length
    ? await db
        .select({ id: roles.id, isSuperAdmin: roles.isSuperAdmin })
        .from(roles)
        .where(and(inArray(roles.id, uniqueRoleIds), eq(roles.scopeType, "global")))
    : [];
  if (validRoles.length !== uniqueRoleIds.length) return { ok: false, error: "roleNotFound" };

  if (targetUserId === actorId) {
    const willKeepAdminAccess = await roleSetGrantsAdminAccess(validRoles.map((r) => r.id));
    if (!willKeepAdminAccess) return { ok: false, error: "selfDemote" };
  }

  const previousRoles = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(and(eq(userRoles.userId, targetUserId), isNull(userRoles.scopeId)));

  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(and(eq(userRoles.userId, targetUserId), isNull(userRoles.scopeId)));
    if (uniqueRoleIds.length) {
      await tx.insert(userRoles).values(uniqueRoleIds.map((roleId) => ({ userId: targetUserId, roleId, scopeId: null })));
    }
    const changes = diffChanges({ roleIds: previousRoles.map((r) => r.roleId).sort((a, b) => a - b) }, { roleIds: [...uniqueRoleIds].sort((a, b) => a - b) });
    if (Object.keys(changes).length > 0) {
      await logAccountActivity({ userId: targetUserId, actorUserId: actorId, event: "updated", description: "Global roles updated", changes, properties: { section: "roles" } }, tx);
    }
  });

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

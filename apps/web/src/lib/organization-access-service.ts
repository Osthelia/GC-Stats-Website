/**
 * GC-Stats - organization-access-service
 *
 * Add/update/remove organization_access grants, applying the rules from
 * organization-access-rules.ts. Shared by admin and /dashboard callers, which
 * only differ in the permission required to reach these functions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizationAccess, organizationAccessRoles, users } from "@gc-stats/db";
import { logActivity } from "@/lib/activity-log";
import { assertRolesGrantable, assertCanModifyGrant, isLastOwnerAccess, type AccessRoleSelection } from "@/lib/organization-access-rules";

export type { AccessRoleSelection } from "@/lib/organization-access-rules";

export type AddAccessFieldErrors = Partial<Record<"user" | "role", string>>;
export type AddAccessResult = { ok: true } | { ok: false; fieldErrors: AddAccessFieldErrors };

/**
 * Shared by admin (actions/admin-organizations.ts, actorIsOwner always
 * true — an admin acting on organizations.manage-access is trusted with the
 * owner role too) and /dashboard (actions/dashboard-organizations.ts,
 * actorIsOwner = the caller's own membership) — the two callers only differ
 * in which permission they require before reaching this, see
 * requireActorPermission vs requireDashboardOrgActorPermission at each call
 * site. Mirrors lib/organization-membership-service.ts's split.
 */
export async function addOrganizationAccessEntry(organizationId: number, userId: string | null, selection: AccessRoleSelection, actorIsOwner: boolean, actorUserId: string): Promise<AddAccessResult> {
  const fieldErrors: AddAccessFieldErrors = {};
  if (!userId) fieldErrors.user = "required";
  const roleError = await assertRolesGrantable(organizationId, selection, actorIsOwner);
  if (roleError) fieldErrors.role = roleError;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId as string)).limit(1);
  if (!user) return { ok: false, fieldErrors: { user: "userNotFound" } };

  const [existing] = await db
    .select({ id: organizationAccess.id })
    .from(organizationAccess)
    .where(and(eq(organizationAccess.userId, userId as string), eq(organizationAccess.organizationId, organizationId)))
    .limit(1);
  if (existing) return { ok: false, fieldErrors: { user: "alreadyHasAccess" } };

  await db.transaction(async (tx) => {
    const [created] = await tx.insert(organizationAccess).values({ userId: userId as string, organizationId, isOwner: selection.isOwner }).returning({ id: organizationAccess.id });
    if (!created) throw new Error("Insert returned no row");
    if (!selection.isOwner && selection.roleIds.length > 0) {
      await tx.insert(organizationAccessRoles).values(selection.roleIds.map((roleId) => ({ accessId: created.id, roleId })));
    }
    await logActivity(
      { subject: "organization", subjectId: organizationId, event: "updated", description: `Granted dashboard access to user ${userId} on organization #${organizationId}`, actorUserId, properties: { section: "access", userId, isOwner: selection.isOwner, roleIds: selection.roleIds } },
      tx
    );
  });

  return { ok: true };
}

export type AccessEntryFieldErrors = Partial<Record<"role", string>>;
export type AccessEntryResult = { ok: true } | { ok: false; fieldErrors: AccessEntryFieldErrors };

/** `checkCanModify` is false for admin callers (always trusted, never blocked by assertCanModifyGrant), true for /dashboard callers. */
export async function updateOrganizationAccessRolesEntry(organizationId: number, accessId: number, selection: AccessRoleSelection, actorIsOwner: boolean, checkCanModify: boolean, actorUserId: string): Promise<AccessEntryResult> {
  const fieldErrors: AccessEntryFieldErrors = {};
  const roleError = await assertRolesGrantable(organizationId, selection, actorIsOwner);
  if (roleError) fieldErrors.role = roleError;

  const [existing] = await db
    .select({ id: organizationAccess.id, userId: organizationAccess.userId, isOwner: organizationAccess.isOwner })
    .from(organizationAccess)
    .where(and(eq(organizationAccess.id, accessId), eq(organizationAccess.organizationId, organizationId)))
    .limit(1);
  if (!existing) return { ok: false, fieldErrors: { role: "notFound" } };

  if (!fieldErrors.role && checkCanModify) {
    const modifyError = assertCanModifyGrant(existing.isOwner, actorIsOwner);
    if (modifyError) fieldErrors.role = modifyError;
  }
  if (!fieldErrors.role && existing.isOwner && !selection.isOwner && (await isLastOwnerAccess(organizationId, accessId))) {
    fieldErrors.role = "lastOwner";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.transaction(async (tx) => {
    await tx.update(organizationAccess).set({ isOwner: selection.isOwner }).where(eq(organizationAccess.id, accessId));
    await tx.delete(organizationAccessRoles).where(eq(organizationAccessRoles.accessId, accessId));
    if (!selection.isOwner && selection.roleIds.length > 0) {
      await tx.insert(organizationAccessRoles).values(selection.roleIds.map((roleId) => ({ accessId, roleId })));
    }
    await logActivity(
      {
        subject: "organization",
        subjectId: organizationId,
        event: "updated",
        description: `Updated dashboard access of user ${existing.userId} on organization #${organizationId}`,
        actorUserId,
        changes: existing.isOwner !== selection.isOwner ? { isOwner: { old: existing.isOwner, new: selection.isOwner } } : undefined,
        properties: { section: "access", userId: existing.userId, isOwner: selection.isOwner, roleIds: selection.roleIds },
      },
      tx
    );
  });

  return { ok: true };
}

export type AccessActionResult = { ok: true } | { ok: false; error: string };

export async function removeOrganizationAccessEntry(organizationId: number, accessId: number, actorIsOwner: boolean, checkCanModify: boolean, actorUserId: string): Promise<AccessActionResult> {
  const [existing] = await db
    .select({ id: organizationAccess.id, userId: organizationAccess.userId, isOwner: organizationAccess.isOwner })
    .from(organizationAccess)
    .where(and(eq(organizationAccess.id, accessId), eq(organizationAccess.organizationId, organizationId)))
    .limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  if (checkCanModify) {
    const modifyError = assertCanModifyGrant(existing.isOwner, actorIsOwner);
    if (modifyError) return { ok: false, error: modifyError };
  }

  if (existing.isOwner && (await isLastOwnerAccess(organizationId, accessId))) {
    return { ok: false, error: "lastOwner" };
  }

  await db.transaction(async (tx) => {
    await tx.delete(organizationAccess).where(eq(organizationAccess.id, accessId));
    await logActivity(
      { subject: "organization", subjectId: organizationId, event: "updated", description: `Revoked dashboard access of user ${existing.userId} on organization #${organizationId}`, actorUserId, properties: { section: "access", userId: existing.userId, wasOwner: existing.isOwner } },
      tx
    );
  });
  return { ok: true };
}

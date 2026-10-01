/**
 * GC-Stats - organization-access-rules
 *
 * Shared safety invariants for organization_access, enforced identically
 * whether the caller is /admin or /dashboard: owner-only grants, protecting
 * an existing owner's access, role ids scoped to the organization, and
 * keeping at least one owner so an org never locks itself out.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizationAccess, organizationRoles } from "@gc-stats/db";

// Shared safety invariants for organization_access, enforced identically
// whether the caller is /admin (actions/admin-organizations.ts) or
// /dashboard (actions/dashboard-organizations.ts) — these must never drift
// apart, an org locking itself out of /dashboard is the same bug either way.

/** isOwner=true means the immutable 'owner' sentinel, roleIds is then ignored/must be empty — a non-owner grant can hold several roles at once (permissions = union), see schema/people.ts. */
export type AccessRoleSelection = { isOwner: boolean; roleIds: number[] };

/**
 * Non-owners (even with membersManage) can never grant/hold the 'owner'
 * role — only an existing owner can create another owner, same "no role
 * grants more than it already has" rule as super-admin-only role
 * management. Admin callers (already gated by a global permission, not org
 * membership) pass actorIsOwner: true to skip this — an admin acting on
 * organizations.manage-access is trusted with it. Also confirms every given
 * roleId actually belongs to this organization (a stale/foreign id from the
 * client is otherwise silently accepted by the FK alone), and that at least
 * one role is picked for a non-owner grant (an access row with zero roles
 * would silently grant nothing).
 */
export async function assertRolesGrantable(organizationId: number, selection: AccessRoleSelection, actorIsOwner: boolean): Promise<string | null> {
  if (selection.isOwner) return actorIsOwner ? null : "ownerOnly";
  if (selection.roleIds.length === 0) return "required";
  const rows = await db
    .select({ id: organizationRoles.id })
    .from(organizationRoles)
    .where(and(eq(organizationRoles.organizationId, organizationId), inArray(organizationRoles.id, selection.roleIds)));
  return rows.length === selection.roleIds.length ? null : "invalidRole";
}

/** The reverse direction of the same rule: a non-owner can't strip/demote an existing owner's access either, even to a permission-bearing role — only an owner can touch another owner's grant. Applies to both role changes and outright removal. Admin callers pass actorIsOwner: true, same as assertRolesGrantable. */
export function assertCanModifyGrant(existingIsOwner: boolean, actorIsOwner: boolean): string | null {
  if (existingIsOwner && !actorIsOwner) return "ownerOnly";
  return null;
}

/** Org must always keep at least one owner — this is the only thing standing between an org and permanently locking itself out of /dashboard. */
export async function isLastOwnerAccess(organizationId: number, accessId: number): Promise<boolean> {
  const owners = await db
    .select({ id: organizationAccess.id })
    .from(organizationAccess)
    .where(and(eq(organizationAccess.organizationId, organizationId), eq(organizationAccess.isOwner, true)));
  return owners.length === 1 && owners[0]?.id === accessId;
}

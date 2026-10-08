/**
 * GC-Stats - organization-membership-service
 *
 * Add/update/delete organization_memberships (the public roster), including
 * closing overlapping open periods for the same person/org/role and
 * auto-granting dashboard access when the org owner opted a role into it.
 * Shared by admin and /dashboard callers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, ne, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db, adminDb } from "@gc-stats/db/client";
import { organizations, organizationMemberships, organizationAccess, organizationAccessRoles, organizationMemberRoleLinks, people } from "@gc-stats/db";
import { closeRange, isRangeOrderInvalid, openRangeFrom } from "@/lib/daterange";
import { ORGANIZATION_MEMBER_ROLES } from "@/lib/organization-roles";
import { logActivity, diffChanges, type ActivityChanges } from "@/lib/activity-log";

type Db = typeof db | PgTransaction<any, any, any>;

/**
 * Opt-in bridge from the "visual" roster (organization_memberships) to real
 * /dashboard access (organization_access) — see organization_member_role_links'
 * own schema comment. No-op unless the organization's owner explicitly linked
 * this exact role, the person has a linked account, and that account doesn't
 * already have access here (never overwrites/escalates an existing grant).
 */
export async function autoGrantAccessForMemberRole(tx: Db, organizationId: number, personId: number, role: string): Promise<void> {
  const [link] = await tx
    .select({ permissionRoleId: organizationMemberRoleLinks.permissionRoleId })
    .from(organizationMemberRoleLinks)
    .where(and(eq(organizationMemberRoleLinks.organizationId, organizationId), eq(organizationMemberRoleLinks.memberRole, role)))
    .limit(1);
  if (!link) return;

  const [person] = await tx.select({ userId: people.userId }).from(people).where(eq(people.id, personId)).limit(1);
  if (!person?.userId) return;

  const [existingAccess] = await tx
    .select({ id: organizationAccess.id })
    .from(organizationAccess)
    .where(and(eq(organizationAccess.userId, person.userId), eq(organizationAccess.organizationId, organizationId)))
    .limit(1);
  if (existingAccess) return;

  const isOwner = link.permissionRoleId === null;
  const [created] = await tx.insert(organizationAccess).values({ userId: person.userId, organizationId, isOwner }).returning({ id: organizationAccess.id });
  if (!isOwner && created) {
    await tx.insert(organizationAccessRoles).values({ accessId: created.id, roleId: link.permissionRoleId as number });
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AddMemberField = "person" | "role" | "from" | "until";
export type AddMemberFieldErrors = Partial<Record<AddMemberField, string>>;
export type AddMemberResult = { ok: true } | { ok: false; fieldErrors: AddMemberFieldErrors };

export type MemberEntryField = "role" | "from" | "until";
export type MemberEntryFieldErrors = Partial<Record<MemberEntryField, string>>;
export type MemberEntryResult = { ok: true } | { ok: false; fieldErrors: MemberEntryFieldErrors };

export type MembershipActionResult = { ok: true } | { ok: false; error: string };

type MemberLogInput = { organizationId: number; personId: number; role: string; actorUserId: string; action: "Added" | "Updated" | "Removed"; changes?: ActivityChanges };

/** An organization roster edit is logged on the organization, and on the player so both histories show it. */
async function logMemberChange(tx: Db, input: MemberLogInput): Promise<void> {
  const { organizationId, personId, role, actorUserId, action, changes } = input;
  const description = `${action} roster entry (${role}) of player #${personId} on organization #${organizationId}`;
  const properties = { section: "members", organizationId, personId, role };
  await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description, actorUserId, changes, properties }, tx);
  await logActivity({ subject: "player", subjectId: personId, event: "updated", description, actorUserId, changes, properties }, tx);
}

function validateEntryFields(role: string, from: string, until: string): Partial<Record<"role" | "from" | "until", string>> {
  const fieldErrors: Partial<Record<"role" | "from" | "until", string>> = {};
  if (!(ORGANIZATION_MEMBER_ROLES as readonly string[]).includes(role)) fieldErrors.role = "invalidRole";
  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && isRangeOrderInvalid(from, until)) fieldErrors.until = "beforeStart";
  return fieldErrors;
}

/**
 * Shared by admin (actions/admin-organizations.ts, no scoping — an admin can
 * touch any organization) and /dashboard (actions/dashboard-organizations.ts,
 * always passes its own organizationId as the scope) — the two callers only
 * differ in which permission they require before reaching this, see
 * requireActorPermission vs requireDashboardOrgActorPermission at each call
 * site.
 */
export async function addOrganizationMemberEntry(organizationId: number, personId: number | null, role: string, from: string, until: string, actorUserId: string): Promise<AddMemberResult> {
  const fieldErrors: AddMemberFieldErrors = { ...validateEntryFields(role, from, until) };
  if (!personId) fieldErrors.person = "required";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, personId as number)).limit(1);
  if (!person) return { ok: false, fieldErrors: { person: "personNotFound" } };

  const [organization] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization) return { ok: false, fieldErrors: { person: "organizationNotFound" } };

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    // A person can't hold the same role on the same organization twice at
    // once (mirrors the EXCLUDE USING gist(person_id, organization_id, role,
    // period) constraint) — close whatever else is open for this (person,
    // org, role) triple before opening a new ongoing one.
    if (isOngoing) {
      const openElsewhere = await tx
        .select({ id: organizationMemberships.id, period: organizationMemberships.period })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.personId, personId as number),
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.role, role),
            sql`${organizationMemberships.period} @> CURRENT_DATE`
          )
        );
      for (const row of openElsewhere) {
        await tx.update(organizationMemberships).set({ period: closeRange(row.period, from) }).where(eq(organizationMemberships.id, row.id));
      }
    }

    await tx.insert(organizationMemberships).values({ personId: personId as number, organizationId, role, period });
    if (isOngoing) await autoGrantAccessForMemberRole(tx, organizationId, personId as number, role);
    await logMemberChange(tx, { organizationId, personId: personId as number, role, actorUserId, action: "Added" });
  });

  return { ok: true };
}

/** `expectedOrganizationId` scopes the lookup for /dashboard callers (a caller only allowed to manage one organization must not be able to touch another org's membership by guessing an id) — admin omits it. */
export async function updateOrganizationMemberEntry(membershipId: number, role: string, from: string, until: string, actorUserId: string, expectedOrganizationId?: number): Promise<MemberEntryResult> {
  const fieldErrors: MemberEntryFieldErrors = validateEntryFields(role, from, until);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [membership] = await db.select().from(organizationMemberships).where(eq(organizationMemberships.id, membershipId)).limit(1);
  if (!membership || (expectedOrganizationId !== undefined && membership.organizationId !== expectedOrganizationId)) {
    return { ok: false, fieldErrors: { role: "notFound" } };
  }

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    if (isOngoing) {
      const openElsewhere = await tx
        .select({ id: organizationMemberships.id, period: organizationMemberships.period })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.personId, membership.personId),
            eq(organizationMemberships.organizationId, membership.organizationId),
            eq(organizationMemberships.role, role),
            sql`${organizationMemberships.period} @> CURRENT_DATE`,
            ne(organizationMemberships.id, membershipId)
          )
        );
      for (const row of openElsewhere) {
        await tx.update(organizationMemberships).set({ period: closeRange(row.period, from) }).where(eq(organizationMemberships.id, row.id));
      }
    }

    await tx.update(organizationMemberships).set({ role, period }).where(eq(organizationMemberships.id, membershipId));
    if (isOngoing) await autoGrantAccessForMemberRole(tx, membership.organizationId, membership.personId, role);
    await logMemberChange(tx, { organizationId: membership.organizationId, personId: membership.personId, role, actorUserId, action: "Updated", changes: diffChanges(membership, { role, period }) });
  });

  return { ok: true };
}

export async function deleteOrganizationMembershipEntry(membershipId: number, actorUserId: string, expectedOrganizationId?: number): Promise<MembershipActionResult> {
  const [membership] = await db
    .select({ organizationId: organizationMemberships.organizationId, personId: organizationMemberships.personId, role: organizationMemberships.role })
    .from(organizationMemberships).where(eq(organizationMemberships.id, membershipId)).limit(1);
  if (!membership || (expectedOrganizationId !== undefined && membership.organizationId !== expectedOrganizationId)) {
    return { ok: false, error: "notFound" };
  }

  await db.transaction(async (tx) => {
    await tx.delete(organizationMemberships).where(eq(organizationMemberships.id, membershipId));
    await logMemberChange(tx, { ...membership, actorUserId, action: "Removed" });
  });
  return { ok: true };
}

/** Plain helper, not a server action: exporting it from a "use server" file made it a public endpoint. */
export async function isPersonOrganizationMember(organizationId: number, personId: number): Promise<boolean> {
  const [row] = await adminDb
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.personId, personId)))
    .limit(1);
  return !!row;
}

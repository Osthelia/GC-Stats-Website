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
import { openRangeFrom, closeRange } from "@/lib/daterange";
import { ORGANIZATION_MEMBER_ROLES } from "@/lib/organization-roles";

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

function validateEntryFields(role: string, from: string, until: string): Partial<Record<"role" | "from" | "until", string>> {
  const fieldErrors: Partial<Record<"role" | "from" | "until", string>> = {};
  if (!(ORGANIZATION_MEMBER_ROLES as readonly string[]).includes(role)) fieldErrors.role = "invalidRole";
  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && until && until <= from) fieldErrors.until = "beforeStart";
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
export async function addOrganizationMemberEntry(organizationId: number, personId: number | null, role: string, from: string, until: string): Promise<AddMemberResult> {
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
  });

  return { ok: true };
}

/** `expectedOrganizationId` scopes the lookup for /dashboard callers (a caller only allowed to manage one organization must not be able to touch another org's membership by guessing an id) — admin omits it. */
export async function updateOrganizationMemberEntry(membershipId: number, role: string, from: string, until: string, expectedOrganizationId?: number): Promise<MemberEntryResult> {
  const fieldErrors: MemberEntryFieldErrors = validateEntryFields(role, from, until);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [membership] = await db
    .select({ id: organizationMemberships.id, personId: organizationMemberships.personId, organizationId: organizationMemberships.organizationId })
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, membershipId))
    .limit(1);
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
  });

  return { ok: true };
}

export async function deleteOrganizationMembershipEntry(membershipId: number, expectedOrganizationId?: number): Promise<MembershipActionResult> {
  const [membership] = await db.select({ id: organizationMemberships.id, organizationId: organizationMemberships.organizationId }).from(organizationMemberships).where(eq(organizationMemberships.id, membershipId)).limit(1);
  if (!membership || (expectedOrganizationId !== undefined && membership.organizationId !== expectedOrganizationId)) {
    return { ok: false, error: "notFound" };
  }

  await db.delete(organizationMemberships).where(eq(organizationMemberships.id, membershipId));
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

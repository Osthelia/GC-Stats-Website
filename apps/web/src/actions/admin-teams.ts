/**
 * GC-Stats - admin-teams
 *
 * Admin server actions for team profiles: profile fields, socials, tags,
 * roster history and name history.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { teams, people, rosterMemberships, teamNameHistory, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { isValidCountryCode } from "@/lib/countries";
import { openRangeFrom, closeRange } from "@/lib/daterange";
import { ROSTER_ROLES } from "@/lib/roster-roles";

// Re-checked here, not just relied on from the /admin layout guard — server
// actions are reachable directly (as their own POST endpoint) regardless of
// which page rendered the form that calls them.
async function requireAdminActorId(permission: string = PERMISSIONS.teamsEdit): Promise<string> {
  const access = await requireActorPermission(permission);
  return access.userId;
}

const SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord", "website"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type TeamProfileInput = {
  name: string;
  shortName: string;
  countryCode: string;
  secondaryCountryCode: string;
  bio: string;
  vlrId: string;
  liquipediaLink: string;
  isActive: boolean;
  socials: Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;
  tags: string[];
};

export type TeamProfileField = "name" | "shortName" | "countryCode" | "secondaryCountryCode" | "vlrId" | "liquipediaLink" | "bio";
export type TeamProfileFieldErrors = Partial<Record<TeamProfileField, string>>;
export type TeamProfileResult = { ok: true } | { ok: false; fieldErrors: TeamProfileFieldErrors };

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updateTeamProfile(teamId: number, input: TeamProfileInput): Promise<TeamProfileResult> {
  await requireAdminActorId();

  const fieldErrors: TeamProfileFieldErrors = {};

  const name = input.name.trim();
  const shortName = input.shortName.trim();
  const countryCode = input.countryCode.trim();
  const secondaryCountryCode = input.secondaryCountryCode.trim();
  const bio = input.bio.trim();
  const vlrId = input.vlrId.trim();
  const liquipediaLink = input.liquipediaLink.trim();

  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  if (shortName.length > 10) fieldErrors.shortName = "tooLong";

  if (countryCode && !isValidCountryCode(countryCode)) fieldErrors.countryCode = "invalid";
  if (secondaryCountryCode && !isValidCountryCode(secondaryCountryCode)) fieldErrors.secondaryCountryCode = "invalid";

  if (bio.length > 2000) fieldErrors.bio = "tooLong";

  let vlrIdValue: number | null = null;
  if (vlrId) {
    if (!/^\d+$/.test(vlrId) || Number(vlrId) > 99_999_999) fieldErrors.vlrId = "invalid";
    else vlrIdValue = Number(vlrId);
  }

  if (liquipediaLink && !isValidUrl(liquipediaLink)) fieldErrors.liquipediaLink = "invalid";

  const [existing] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { name: "notFound" } };

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const socials: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (value) socials[key] = value;
  }

  const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))];

  await db
    .update(teams)
    .set({
      name,
      shortName: shortName || null,
      countryCode: countryCode || null,
      secondaryCountryCode: secondaryCountryCode || null,
      bio: bio || null,
      vlrId: vlrIdValue,
      liquipediaLink: liquipediaLink || null,
      isActive: input.isActive,
      socials,
      tags,
    })
    .where(eq(teams.id, teamId));

  return { ok: true };
}

export type NameHistoryFieldErrors = Partial<Record<"name" | "from" | "until", string>>;
export type NameHistoryResult = { ok: true } | { ok: false; fieldErrors: NameHistoryFieldErrors };

export async function addTeamNameHistoryEntry(teamId: number, name: string, from: string, until: string): Promise<NameHistoryResult> {
  await requireAdminActorId();

  const fieldErrors: NameHistoryFieldErrors = {};
  const trimmedName = name.trim();

  if (!trimmedName) fieldErrors.name = "required";
  else if (trimmedName.length > 255) fieldErrors.name = "tooLong";

  if (!DATE_RE.test(from)) fieldErrors.from = "invalid";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalid";
  if (!fieldErrors.from && !fieldErrors.until && until && until <= from) fieldErrors.until = "beforeStart";

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { ok: false, fieldErrors: { name: "notFound" } };

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.insert(teamNameHistory).values({
    teamId,
    name: trimmedName,
    period: until ? `[${from},${until})` : openRangeFrom(from),
    isVisible: true,
  });

  return { ok: true };
}

export async function deleteTeamNameHistoryEntry(entryId: number): Promise<RosterActionResult> {
  await requireAdminActorId();

  const [entry] = await db.select({ id: teamNameHistory.id }).from(teamNameHistory).where(eq(teamNameHistory.id, entryId)).limit(1);
  if (!entry) return { ok: false, error: "notFound" };

  await db.delete(teamNameHistory).where(eq(teamNameHistory.id, entryId));
  return { ok: true };
}

export async function toggleTeamNameHistoryVisibility(entryId: number, isVisible: boolean): Promise<RosterActionResult> {
  await requireAdminActorId();

  const [entry] = await db.select({ id: teamNameHistory.id }).from(teamNameHistory).where(eq(teamNameHistory.id, entryId)).limit(1);
  if (!entry) return { ok: false, error: "notFound" };

  await db.update(teamNameHistory).set({ isVisible }).where(eq(teamNameHistory.id, entryId));
  return { ok: true };
}

export type RosterActionResult = { ok: true } | { ok: false; error: string };

/** Hard delete (not "close the period") — for a mistaken entry, not for someone actually leaving the team (use updateRosterMemberEntry's `until` for that). Shared by both the team roster panel and the player-side team-history panel (same rosterMemberships row). */
export async function deleteRosterMembership(membershipId: number): Promise<RosterActionResult> {
  await requireAdminActorId();

  const [membership] = await db.select({ id: rosterMemberships.id }).from(rosterMemberships).where(eq(rosterMemberships.id, membershipId)).limit(1);
  if (!membership) return { ok: false, error: "notFound" };

  await db.delete(rosterMemberships).where(eq(rosterMemberships.id, membershipId));
  return { ok: true };
}

export type AddRosterMemberField = "person" | "role" | "from" | "until";
export type AddRosterMemberFieldErrors = Partial<Record<AddRosterMemberField, string>>;
export type AddRosterMemberResult = { ok: true } | { ok: false; fieldErrors: AddRosterMemberFieldErrors };

export async function addTeamRosterMember(
  teamId: number,
  personId: number | null,
  role: string,
  from: string,
  until: string,
  inactiveSince: string | null
): Promise<AddRosterMemberResult> {
  await requireAdminActorId();

  const fieldErrors: AddRosterMemberFieldErrors = {};

  if (!personId) fieldErrors.person = "required";
  if (!(ROSTER_ROLES as readonly string[]).includes(role)) fieldErrors.role = "invalidRole";
  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && until && until <= from) fieldErrors.until = "beforeStart";
  if (inactiveSince && !DATE_RE.test(inactiveSince)) fieldErrors.from = fieldErrors.from ?? "invalidDate";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, personId as number)).limit(1);
  if (!person) return { ok: false, fieldErrors: { person: "personNotFound" } };

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { ok: false, fieldErrors: { person: "teamNotFound" } };

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    // Mirrors V1 RosterService::save — a person can't be marked 'player' (or
    // any other role) as currently active on two teams at once, so close out
    // whatever else is open for that (person, role) pair before opening this
    // one — only relevant when the new row is itself ongoing (backfilling a
    // closed historical stint doesn't touch anyone's current membership).
    if (isOngoing) {
      const openElsewhere = await tx
        .select({ id: rosterMemberships.id, period: rosterMemberships.period })
        .from(rosterMemberships)
        .where(
          and(
            eq(rosterMemberships.personId, personId as number),
            eq(rosterMemberships.role, role),
            sql`${rosterMemberships.period} @> CURRENT_DATE`
          )
        );

      for (const row of openElsewhere) {
        await tx.update(rosterMemberships).set({ period: closeRange(row.period, from) }).where(eq(rosterMemberships.id, row.id));
      }
    }

    await tx.insert(rosterMemberships).values({ personId: personId as number, teamId, role, period, inactiveSince: inactiveSince || null });
  });

  return { ok: true };
}

export type RosterEntryField = "role" | "from" | "until" | "inactiveSince";
export type RosterEntryFieldErrors = Partial<Record<RosterEntryField, string>>;
export type RosterEntryResult = { ok: true } | { ok: false; fieldErrors: RosterEntryFieldErrors };

/**
 * Full inline edit for an *existing* roster row (role, join date, left
 * date, inactive-since) — mirrors V1's roster-entry-card, where every card
 * (current and history alike) carries editable role/joined_at/left_at
 * inputs directly, not just newly-added ones.
 */
export async function updateRosterMemberEntry(membershipId: number, role: string, from: string, until: string, inactiveSince: string): Promise<RosterEntryResult> {
  await requireAdminActorId();

  const fieldErrors: RosterEntryFieldErrors = {};

  if (!(ROSTER_ROLES as readonly string[]).includes(role)) fieldErrors.role = "invalidRole";
  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && until && until <= from) fieldErrors.until = "beforeStart";
  if (inactiveSince && !DATE_RE.test(inactiveSince)) fieldErrors.inactiveSince = "invalidDate";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [membership] = await db.select({ id: rosterMemberships.id, personId: rosterMemberships.personId }).from(rosterMemberships).where(eq(rosterMemberships.id, membershipId)).limit(1);
  if (!membership) return { ok: false, fieldErrors: { role: "notFound" } };

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    // Same anti-overlap rule as addTeamRosterMember — only matters when
    // this edit makes the row ongoing again.
    if (isOngoing) {
      const openElsewhere = await tx
        .select({ id: rosterMemberships.id, period: rosterMemberships.period })
        .from(rosterMemberships)
        .where(
          and(
            eq(rosterMemberships.personId, membership.personId),
            eq(rosterMemberships.role, role),
            sql`${rosterMemberships.period} @> CURRENT_DATE`,
            sql`${rosterMemberships.id} != ${membershipId}`
          )
        );

      for (const row of openElsewhere) {
        await tx.update(rosterMemberships).set({ period: closeRange(row.period, from) }).where(eq(rosterMemberships.id, row.id));
      }
    }

    await tx.update(rosterMemberships).set({ role, period, inactiveSince: inactiveSince || null }).where(eq(rosterMemberships.id, membershipId));
  });

  return { ok: true };
}

export type CreateTeamInput = { name: string; shortName: string; countryCode: string; vlrId: string };
export type CreateTeamField = "name" | "shortName" | "countryCode" | "vlrId";
export type CreateTeamFieldErrors = Partial<Record<CreateTeamField, string>>;
export type CreateTeamResult = { ok: true; id: number } | { ok: false; fieldErrors: CreateTeamFieldErrors };

/** Quick-create from the admin teams list — mirrors createPlayer's shape (name required, everything else optional, full profile editable afterwards). */
export async function createTeam(input: CreateTeamInput): Promise<CreateTeamResult> {
  await requireAdminActorId(PERMISSIONS.teamsCreate);

  const fieldErrors: CreateTeamFieldErrors = {};

  const name = input.name.trim();
  const shortName = input.shortName.trim();
  const countryCode = input.countryCode.trim();
  const vlrId = input.vlrId.trim();

  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  if (shortName.length > 10) fieldErrors.shortName = "tooLong";

  if (countryCode && !isValidCountryCode(countryCode)) fieldErrors.countryCode = "invalid";

  let vlrIdValue: number | null = null;
  if (vlrId) {
    if (!/^\d+$/.test(vlrId) || Number(vlrId) > 99_999_999) fieldErrors.vlrId = "invalid";
    else vlrIdValue = Number(vlrId);
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(teams)
    .values({ name, shortName: shortName || null, countryCode: countryCode || null, vlrId: vlrIdValue, isActive: true, socials: {}, tags: [] })
    .returning({ id: teams.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export type DeleteTeamResult = { ok: true } | { ok: false; error: "notFound" | "inUse" };

/**
 * Hard-deletes a team. Roster memberships/name history cascade (onDelete:
 * "cascade" in schema), but entrants/stats FKs don't — a team that has
 * actually played in a tournament is caught by the FK violation (Postgres
 * 23503) below and reported as "inUse" rather than a generic 500, since
 * that's a real, expected outcome (not a bug) once real tournament data
 * exists.
 */
export async function deleteTeam(teamId: number): Promise<DeleteTeamResult> {
  await requireAdminActorId(PERMISSIONS.teamsDelete);

  const [existing] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await db.delete(teams).where(eq(teams.id, teamId));
  } catch (error) {
    if (isForeignKeyViolation(error)) return { ok: false, error: "inUse" };
    throw error;
  }

  return { ok: true };
}

function isForeignKeyViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.cause?.code ?? (error as { code?: string })?.code;
  return code === "23503";
}

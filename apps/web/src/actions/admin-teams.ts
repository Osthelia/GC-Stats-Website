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

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { teams, people, rosterMemberships, teamNameHistory, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { isValidCountryCode } from "@/lib/countries";
import { closeRange, isRangeOrderInvalid, openRangeFrom } from "@/lib/daterange";
import { ROSTER_ROLES } from "@/lib/roster-roles";
import { logActivity, diffChanges } from "@/lib/activity-log";
import { logRosterChange } from "@/lib/roster-activity-log";

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
  const actorUserId = await requireAdminActorId();

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

  const [existing] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { name: "notFound" } };

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const socials: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (value) socials[key] = value;
  }

  const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))];

  const values = {
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
  };

  await db.transaction(async (tx) => {
    await tx.update(teams).set(values).where(eq(teams.id, teamId));
    const changes = diffChanges(existing, values);
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "team", subjectId: teamId, event: "updated", description: `Updated team #${teamId} (${name})`, actorUserId, changes }, tx);
    }
  });

  return { ok: true };
}

export type NameHistoryFieldErrors = Partial<Record<"name" | "from" | "until", string>>;
export type NameHistoryResult = { ok: true } | { ok: false; fieldErrors: NameHistoryFieldErrors };

export async function addTeamNameHistoryEntry(teamId: number, name: string, from: string, until: string): Promise<NameHistoryResult> {
  const actorUserId = await requireAdminActorId();

  const fieldErrors: NameHistoryFieldErrors = {};
  const trimmedName = name.trim();

  if (!trimmedName) fieldErrors.name = "required";
  else if (trimmedName.length > 255) fieldErrors.name = "tooLong";

  if (!DATE_RE.test(from)) fieldErrors.from = "invalid";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalid";
  if (!fieldErrors.from && !fieldErrors.until && isRangeOrderInvalid(from, until)) fieldErrors.until = "beforeStart";

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { ok: false, fieldErrors: { name: "notFound" } };

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.transaction(async (tx) => {
    await tx.insert(teamNameHistory).values({
      teamId,
      name: trimmedName,
      period: until ? `[${from},${until})` : openRangeFrom(from),
      isVisible: true,
    });
    await logActivity(
      { subject: "team", subjectId: teamId, event: "updated", description: `Added name "${trimmedName}" to the history of team #${teamId}`, actorUserId, properties: { section: "nameHistory", name: trimmedName, from, until: until || null } },
      tx
    );
  });

  return { ok: true };
}

export async function deleteTeamNameHistoryEntry(entryId: number): Promise<RosterActionResult> {
  const actorUserId = await requireAdminActorId();

  const [entry] = await db.select({ id: teamNameHistory.id, teamId: teamNameHistory.teamId, name: teamNameHistory.name }).from(teamNameHistory).where(eq(teamNameHistory.id, entryId)).limit(1);
  if (!entry) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(teamNameHistory).where(eq(teamNameHistory.id, entryId));
    await logActivity(
      { subject: "team", subjectId: entry.teamId, event: "updated", description: `Removed name "${entry.name}" from the history of team #${entry.teamId}`, actorUserId, properties: { section: "nameHistory", name: entry.name } },
      tx
    );
  });
  return { ok: true };
}

export async function toggleTeamNameHistoryVisibility(entryId: number, isVisible: boolean): Promise<RosterActionResult> {
  const actorUserId = await requireAdminActorId();

  const [entry] = await db
    .select({ id: teamNameHistory.id, teamId: teamNameHistory.teamId, name: teamNameHistory.name, isVisible: teamNameHistory.isVisible })
    .from(teamNameHistory)
    .where(eq(teamNameHistory.id, entryId))
    .limit(1);
  if (!entry) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.update(teamNameHistory).set({ isVisible }).where(eq(teamNameHistory.id, entryId));
    await logActivity(
      {
        subject: "team",
        subjectId: entry.teamId,
        event: "updated",
        description: `${isVisible ? "Showed" : "Hid"} name "${entry.name}" in the history of team #${entry.teamId}`,
        actorUserId,
        changes: { isVisible: { old: entry.isVisible, new: isVisible } },
        properties: { section: "nameHistory", name: entry.name },
      },
      tx
    );
  });
  return { ok: true };
}

export type RosterActionResult = { ok: true } | { ok: false; error: string };

/** Hard delete (not "close the period") — for a mistaken entry, not for someone actually leaving the team (use updateRosterMemberEntry's `until` for that). Shared by both the team roster panel and the player-side team-history panel (same rosterMemberships row). */
export async function deleteRosterMembership(membershipId: number): Promise<RosterActionResult> {
  const actorUserId = await requireAdminActorId();

  const [membership] = await db
    .select({ teamId: rosterMemberships.teamId, personId: rosterMemberships.personId, role: rosterMemberships.role })
    .from(rosterMemberships)
    .where(eq(rosterMemberships.id, membershipId))
    .limit(1);
  if (!membership) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(rosterMemberships).where(eq(rosterMemberships.id, membershipId));
    await logRosterChange(tx, { ...membership, actorUserId, action: "Removed" });
  });
  return { ok: true };
}

export type RosterConflict = { membershipId: number; teamId: number; teamName: string; role: string };

/** Open (no end date) memberships of a person on other teams than `teamId`. */
async function findOpenMembershipsElsewhere(personId: number, teamId: number, excludeMembershipId?: number): Promise<RosterConflict[]> {
  const conditions = [eq(rosterMemberships.personId, personId), ne(rosterMemberships.teamId, teamId), sql`upper_inf(${rosterMemberships.period})`];
  if (excludeMembershipId) conditions.push(ne(rosterMemberships.id, excludeMembershipId));
  return db
    .select({ membershipId: rosterMemberships.id, teamId: rosterMemberships.teamId, teamName: teams.name, role: rosterMemberships.role })
    .from(rosterMemberships)
    .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .where(and(...conditions));
}

/** Called before saving a roster entry without end date, to ask whether the person's other current teams must be closed. */
export async function getRosterConflicts(personId: number, teamId: number, excludeMembershipId?: number): Promise<RosterConflict[]> {
  await requireAdminActorId();
  return findOpenMembershipsElsewhere(personId, teamId, excludeMembershipId);
}

/** Closes the chosen memberships at `closeAt`, only if they are still open memberships of that person on other teams. */
async function closeOpenMemberships(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ids: number[], personId: number, teamId: number, closeAt: string): Promise<void> {
  if (ids.length === 0) return;
  const rows = await tx
    .select({ id: rosterMemberships.id, period: rosterMemberships.period })
    .from(rosterMemberships)
    .where(and(inArray(rosterMemberships.id, ids), eq(rosterMemberships.personId, personId), ne(rosterMemberships.teamId, teamId), sql`upper_inf(${rosterMemberships.period})`));
  for (const row of rows) {
    await tx.update(rosterMemberships).set({ period: closeRange(row.period, closeAt) }).where(eq(rosterMemberships.id, row.id));
  }
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
  inactiveSince: string | null,
  closeMembershipIds: number[] = []
): Promise<AddRosterMemberResult> {
  const actorUserId = await requireAdminActorId();

  const fieldErrors: AddRosterMemberFieldErrors = {};

  if (!personId) fieldErrors.person = "required";
  if (!(ROSTER_ROLES as readonly string[]).includes(role)) fieldErrors.role = "invalidRole";
  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && isRangeOrderInvalid(from, until)) fieldErrors.until = "beforeStart";
  if (inactiveSince && !DATE_RE.test(inactiveSince)) fieldErrors.from = fieldErrors.from ?? "invalidDate";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, personId as number)).limit(1);
  if (!person) return { ok: false, fieldErrors: { person: "personNotFound" } };

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { ok: false, fieldErrors: { person: "teamNotFound" } };

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    if (isOngoing) await closeOpenMemberships(tx, closeMembershipIds, personId as number, teamId, from);

    await tx.insert(rosterMemberships).values({ personId: personId as number, teamId, role, period, inactiveSince: inactiveSince || null });
    await logRosterChange(tx, { teamId, personId: personId as number, role, actorUserId, action: "Added" });
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
export async function updateRosterMemberEntry(membershipId: number, role: string, from: string, until: string, inactiveSince: string, closeMembershipIds: number[] = []): Promise<RosterEntryResult> {
  const actorUserId = await requireAdminActorId();

  const fieldErrors: RosterEntryFieldErrors = {};

  if (!(ROSTER_ROLES as readonly string[]).includes(role)) fieldErrors.role = "invalidRole";
  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && isRangeOrderInvalid(from, until)) fieldErrors.until = "beforeStart";
  if (inactiveSince && !DATE_RE.test(inactiveSince)) fieldErrors.inactiveSince = "invalidDate";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [membership] = await db.select().from(rosterMemberships).where(eq(rosterMemberships.id, membershipId)).limit(1);
  if (!membership) return { ok: false, fieldErrors: { role: "notFound" } };

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    if (isOngoing) await closeOpenMemberships(tx, closeMembershipIds, membership.personId, membership.teamId, from);

    const values = { role, period, inactiveSince: inactiveSince || null };
    await tx.update(rosterMemberships).set(values).where(eq(rosterMemberships.id, membershipId));
    await logRosterChange(tx, { teamId: membership.teamId, personId: membership.personId, role, actorUserId, action: "Updated", changes: diffChanges(membership, values) });
  });

  return { ok: true };
}

export type CreateTeamInput = { name: string; shortName: string; countryCode: string; vlrId: string };
export type CreateTeamField = "name" | "shortName" | "countryCode" | "vlrId";
export type CreateTeamFieldErrors = Partial<Record<CreateTeamField, string>>;
export type CreateTeamResult = { ok: true; id: number } | { ok: false; fieldErrors: CreateTeamFieldErrors };

/** Quick-create from the admin teams list — mirrors createPlayer's shape (name required, everything else optional, full profile editable afterwards). */
export async function createTeam(input: CreateTeamInput): Promise<CreateTeamResult> {
  const actorUserId = await requireAdminActorId(PERMISSIONS.teamsCreate);

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

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(teams)
      .values({ name, shortName: shortName || null, countryCode: countryCode || null, vlrId: vlrIdValue, isActive: true, socials: {}, tags: [] })
      .returning({ id: teams.id });
    if (!row) throw new Error("Insert returned no row");
    await logActivity({ subject: "team", subjectId: row.id, event: "created", description: `Created team #${row.id} (${name})`, actorUserId }, tx);
    return row;
  });

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
  const actorUserId = await requireAdminActorId(PERMISSIONS.teamsDelete);

  const [existing] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await db.transaction(async (tx) => {
      await tx.delete(teams).where(eq(teams.id, teamId));
      await logActivity({ subject: "team", subjectId: teamId, event: "deleted", description: `Deleted team #${teamId} (${existing.name})`, actorUserId }, tx);
    });
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

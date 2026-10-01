/**
 * GC-Stats - admin-players
 *
 * Admin server actions for player profiles: create/edit profile fields,
 * roster history, and linking/unlinking a player to a site user account.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { people, teams, rosterMemberships, users, PERMISSIONS } from "@gc-stats/db";
import { requireActorAccess, requireActorPermission } from "@/lib/rbac";
import { MATCH_STATS_TAG } from "@/lib/cache-tags";
import { isValidCountryCode } from "@/lib/countries";
import { openRangeFrom, closeRange } from "@/lib/daterange";
import { ROSTER_ROLES } from "@/lib/roster-roles";
import { searchPeopleQuery, type PersonPickerResult } from "@/lib/person-search";
import { searchUsersQuery, type UserPickerResult } from "@/lib/user-search";
import { searchTeamsQuery } from "@/lib/team-search";
import { linkUserToPersonEntry, unlinkUserFromPersonEntry, type LinkUserResult } from "@/lib/person-link-service";
import { PERSON_SOCIAL_KEYS } from "@/lib/person-social-keys";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Re-checked here, not just relied on from the /admin layout guard — server
// actions are reachable directly (as their own POST endpoint) regardless of
// which page rendered the form that calls them.
async function requireAdminActorId(permission: string): Promise<string> {
  const access = await requireActorPermission(permission);
  return access.userId;
}

const SOCIAL_KEYS = PERSON_SOCIAL_KEYS;
const PRONOUN_OPTIONS = [0, 1, 2] as const;

export type PlayerProfileInput = {
  handle: string;
  aliases: string[];
  firstName: string;
  lastName: string;
  countryCode: string;
  secondaryCountryCode: string;
  pronouns: string; // "0" | "1" | "2" | ""
  bio: string;
  vlrId: string;
  valId: string;
  esportsValId: string;
  liquipediaLink: string;
  isActive: boolean;
  socials: Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;
};

export type PlayerProfileField = "handle" | "countryCode" | "secondaryCountryCode" | "pronouns" | "vlrId" | "valId" | "esportsValId" | "liquipediaLink" | "bio";
export type PlayerProfileFieldErrors = Partial<Record<PlayerProfileField, string>> & {
  socials?: Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;
};
export type PlayerProfileResult = { ok: true } | { ok: false; fieldErrors: PlayerProfileFieldErrors };

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function updatePlayerProfile(playerId: number, input: PlayerProfileInput): Promise<PlayerProfileResult> {
  await requireAdminActorId(PERMISSIONS.playersEdit);

  const fieldErrors: PlayerProfileFieldErrors = {};

  const handle = input.handle.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const countryCode = input.countryCode.trim();
  const secondaryCountryCode = input.secondaryCountryCode.trim();
  const bio = input.bio.trim();
  const vlrId = input.vlrId.trim();
  const liquipediaLink = input.liquipediaLink.trim();

  if (!handle) fieldErrors.handle = "required";
  else if (handle.length > 255) fieldErrors.handle = "tooLong";

  if (countryCode && !isValidCountryCode(countryCode)) fieldErrors.countryCode = "invalid";
  if (secondaryCountryCode && !isValidCountryCode(secondaryCountryCode)) fieldErrors.secondaryCountryCode = "invalid";

  let pronounsValue: number | null = null;
  if (input.pronouns) {
    const n = Number(input.pronouns);
    if (!(PRONOUN_OPTIONS as readonly number[]).includes(n)) fieldErrors.pronouns = "invalid";
    else pronounsValue = n;
  }

  if (bio.length > 2000) fieldErrors.bio = "tooLong";

  let vlrIdValue: number | null = null;
  if (vlrId) {
    if (!/^\d+$/.test(vlrId) || Number(vlrId) > 99_999_999) fieldErrors.vlrId = "invalid";
    else vlrIdValue = Number(vlrId);
  }

  if (liquipediaLink && !isValidUrl(liquipediaLink)) fieldErrors.liquipediaLink = "invalid";

  const valId = input.valId.trim();
  const esportsValId = input.esportsValId.trim();

  if (valId.length > 255) fieldErrors.valId = "tooLong";
  if (esportsValId.length > 255) fieldErrors.esportsValId = "tooLong";

  const [existing] = await db.select({ id: people.id }).from(people).where(eq(people.id, playerId)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { handle: "notFound" } };

  // Uniqueness checks only run once the field is otherwise well-formed, and
  // only hit the DB when the value actually changed — Riot IDs are unique
  // per person and normally set by the ingestion pipeline, not typed by hand.
  if (!fieldErrors.valId && valId) {
    const [taken] = await db.select({ id: people.id }).from(people).where(and(eq(people.valId, valId), ne(people.id, playerId))).limit(1);
    if (taken) fieldErrors.valId = "taken";
  }
  if (!fieldErrors.esportsValId && esportsValId) {
    const [taken] = await db.select({ id: people.id }).from(people).where(and(eq(people.esportsValId, esportsValId), ne(people.id, playerId))).limit(1);
    if (taken) fieldErrors.esportsValId = "taken";
  }

  const socials: Record<string, string> = {};
  const socialErrors: Partial<Record<(typeof SOCIAL_KEYS)[number], string>> = {};
  for (const key of SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (!value) continue;
    if (value.length > 2000) socialErrors[key] = "tooLong";
    else if (!isValidUrl(value)) socialErrors[key] = "invalid";
    else socials[key] = value;
  }
  if (Object.keys(socialErrors).length > 0) fieldErrors.socials = socialErrors;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const aliases = [...new Set(input.aliases.map((a) => a.trim()).filter(Boolean))];

  await db
    .update(people)
    .set({
      handle,
      aliases,
      firstName: firstName || null,
      lastName: lastName || null,
      countryCode: countryCode || null,
      secondaryCountryCode: secondaryCountryCode || null,
      pronouns: pronounsValue,
      bio: bio || null,
      vlrId: vlrIdValue,
      valId: valId || null,
      esportsValId: esportsValId || null,
      liquipediaLink: liquipediaLink || null,
      isActive: input.isActive,
      socials,
    })
    .where(eq(people.id, playerId));
  // Match scoreboards show the current handle.
  updateTag(MATCH_STATS_TAG);

  return { ok: true };
}

export type { LinkUserResult } from "@/lib/person-link-service";

export async function linkUserToPlayer(playerId: number, userId: string): Promise<LinkUserResult> {
  await requireAdminActorId(PERMISSIONS.playersEdit);
  return linkUserToPersonEntry(playerId, userId);
}

export async function unlinkUserFromPlayer(playerId: number): Promise<LinkUserResult> {
  await requireAdminActorId(PERMISSIONS.playersEdit);
  return unlinkUserFromPersonEntry(playerId);
}

export type { UserPickerResult } from "@/lib/user-search";

/** Typo-tolerant user search backing UserPicker — for the player "linked account" flow. */
export async function searchUsersForLink(query: string): Promise<UserPickerResult[]> {
  await requireActorAccess();
  return searchUsersQuery(query);
}

export type { PersonPickerResult } from "@/lib/person-search";

/**
 * Typo-tolerant people search backing PersonPicker (the roster "add
 * member" dropdown). Read-only, but still gated behind admin access since
 * it's reachable as its own server-action endpoint.
 */
export async function searchPeople(query: string): Promise<PersonPickerResult[]> {
  await requireActorAccess();
  return searchPeopleQuery(query);
}

export type CreatePlayerInput = { handle: string; countryCode: string; vlrId: string; teamId: string };
export type CreatePlayerField = "handle" | "countryCode" | "vlrId" | "teamId";
export type CreatePlayerFieldErrors = Partial<Record<CreatePlayerField, string>>;
export type CreatePlayerResult = { ok: true; id: number } | { ok: false; fieldErrors: CreatePlayerFieldErrors };

/**
 * Quick-create from the admin players list — mirrors V1
 * PlayerController::store (handle required, everything else optional).
 * When a team is picked the new player joins its current roster as
 * 'player' starting today, same as V1's RosterService::addMember call.
 */
export async function createPlayer(input: CreatePlayerInput): Promise<CreatePlayerResult> {
  await requireAdminActorId(PERMISSIONS.playersCreate);

  const fieldErrors: CreatePlayerFieldErrors = {};

  const handle = input.handle.trim();
  const countryCode = input.countryCode.trim();
  const vlrId = input.vlrId.trim();
  const teamId = input.teamId.trim();

  if (!handle) fieldErrors.handle = "required";
  else if (handle.length > 255) fieldErrors.handle = "tooLong";

  if (countryCode && !isValidCountryCode(countryCode)) fieldErrors.countryCode = "invalid";

  let vlrIdValue: number | null = null;
  if (vlrId) {
    if (!/^\d+$/.test(vlrId) || Number(vlrId) > 99_999_999) fieldErrors.vlrId = "invalid";
    else vlrIdValue = Number(vlrId);
  }

  let teamIdValue: number | null = null;
  if (teamId) {
    if (!/^\d+$/.test(teamId)) fieldErrors.teamId = "invalid";
    else {
      const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, Number(teamId))).limit(1);
      if (!team) fieldErrors.teamId = "invalid";
      else teamIdValue = team.id;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const player = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(people)
      .values({ handle, countryCode: countryCode || null, vlrId: vlrIdValue, isActive: true })
      .returning({ id: people.id });
    const created = inserted[0];
    if (!created) throw new Error("Insert returned no row");

    if (teamIdValue !== null) {
      await tx.insert(rosterMemberships).values({ personId: created.id, teamId: teamIdValue, role: "player", period: openRangeFrom(new Date().toISOString().slice(0, 10)) });
    }

    return created;
  });

  return { ok: true, id: player.id };
}

/** Typo-tolerant team search backing TeamPicker — mirrors searchPeople above, for the player-side "add team history" picker. */
export async function searchTeams(query: string) {
  await requireActorAccess();
  return searchTeamsQuery(query);
}

export type AddTeamHistoryField = "team" | "role" | "from" | "until" | "inactiveSince";
export type AddTeamHistoryFieldErrors = Partial<Record<AddTeamHistoryField, string>>;
export type AddTeamHistoryResult = { ok: true } | { ok: false; fieldErrors: AddTeamHistoryFieldErrors };

/** Player-side mirror of admin-teams.ts::addTeamRosterMember — same anti-overlap rule, just keyed the other way (fixed person, picked team). */
export async function addPlayerTeamHistoryEntry(
  personId: number,
  teamId: number | null,
  role: string,
  from: string,
  until: string,
  inactiveSince: string | null
): Promise<AddTeamHistoryResult> {
  await requireAdminActorId(PERMISSIONS.playersEdit);

  const fieldErrors: AddTeamHistoryFieldErrors = {};

  if (!teamId) fieldErrors.team = "required";
  if (!(ROSTER_ROLES as readonly string[]).includes(role)) fieldErrors.role = "invalidRole";
  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && until && until <= from) fieldErrors.until = "beforeStart";
  if (inactiveSince && !DATE_RE.test(inactiveSince)) fieldErrors.inactiveSince = "invalidDate";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return { ok: false, fieldErrors: { team: "personNotFound" } };

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId as number)).limit(1);
  if (!team) return { ok: false, fieldErrors: { team: "teamNotFound" } };

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    if (isOngoing) {
      const openElsewhere = await tx
        .select({ id: rosterMemberships.id, period: rosterMemberships.period })
        .from(rosterMemberships)
        .where(and(eq(rosterMemberships.personId, personId), eq(rosterMemberships.role, role), sql`${rosterMemberships.period} @> CURRENT_DATE`));

      for (const row of openElsewhere) {
        await tx.update(rosterMemberships).set({ period: closeRange(row.period, from) }).where(eq(rosterMemberships.id, row.id));
      }
    }

    await tx.insert(rosterMemberships).values({ personId, teamId: teamId as number, role, period, inactiveSince: inactiveSince || null });
  });

  return { ok: true };
}

export type TeamHistoryEntryField = "role" | "from" | "until" | "inactiveSince";
export type TeamHistoryEntryFieldErrors = Partial<Record<TeamHistoryEntryField, string>>;
export type TeamHistoryEntryResult = { ok: true } | { ok: false; fieldErrors: TeamHistoryEntryFieldErrors };

/** Player-side mirror of admin-teams.ts::updateRosterMemberEntry — inline edit for an existing team-history card (role/join/left/inactive, not reassigning the team itself). */
export async function updatePlayerTeamHistoryEntry(membershipId: number, role: string, from: string, until: string, inactiveSince: string): Promise<TeamHistoryEntryResult> {
  await requireAdminActorId(PERMISSIONS.playersEdit);

  const fieldErrors: TeamHistoryEntryFieldErrors = {};

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

export type DeletePlayerResult = { ok: true } | { ok: false; error: "notFound" | "inUse" };

/**
 * Hard-deletes a player. Roster/team-history memberships cascade (onDelete:
 * "cascade" in schema), but entrants/stats FKs don't — a player who has
 * actually played in a tournament is caught by the FK violation (Postgres
 * 23503) below and reported as "inUse" rather than a generic 500, since
 * that's a real, expected outcome (not a bug) once real tournament data
 * exists. Mirrors deleteTeam in admin-teams.ts.
 */
export async function deletePlayer(playerId: number): Promise<DeletePlayerResult> {
  await requireAdminActorId(PERMISSIONS.playersDelete);

  const [existing] = await db.select({ id: people.id }).from(people).where(eq(people.id, playerId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await db.delete(people).where(eq(people.id, playerId));
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

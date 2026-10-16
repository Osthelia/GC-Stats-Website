/**
 * GC-Stats - person-link-service
 *
 * Links/unlinks a `people` row to a user account, retroactively applying any
 * opted-in member-role access grants once the person has an account to
 * receive them. Shared by admin and /dashboard callers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users, sharedPeople, gameTables } from "@gc-stats/db";
import { setPersonUser } from "@/lib/person-service";
import { autoGrantAccessForMemberRole } from "@/lib/organization-membership-service";
import { logActivity } from "@/lib/activity-log";
import type { GameSlug } from "@gc-stats/db/game";

export type LinkUserResult = { ok: true } | { ok: false; error: string };

/**
 * Shared by admin (actions/admin-players.ts, no scoping) and /dashboard
 * (actions/dashboard-organizations.ts, scoped to this organization's own
 * roster) — mirrors V1 PlayerController::linkUser (unique-elsewhere check).
 */
export async function linkUserToPersonEntry(game: GameSlug, personId: number, userId: string, actorUserId: string): Promise<LinkUserResult> {
  const { people, organizationMemberships } = gameTables(game);
  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return { ok: false, error: "notFound" };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, error: "userNotFound" };

  // One account links to one person, whatever the game.
  const [alreadyLinked] = await db.select({ id: sharedPeople.id }).from(sharedPeople).where(and(eq(sharedPeople.userId, userId), ne(sharedPeople.id, personId))).limit(1);
  if (alreadyLinked) return { ok: false, error: "alreadyLinked" };

  await setPersonUser(db, personId, userId);
  await logActivity({ game, subject: "player", subjectId: personId, event: "updated", description: `Linked account ${userId} to player #${personId}`, actorUserId, changes: { userId: { old: null, new: userId } } }, db);

  // Retroactively apply any opted-in member-role -> access-role link for
  // every organization this person is currently listed on, now that they
  // have an account to grant it to (see autoGrantAccessForMemberRole).
  const currentMemberships = await db
    .select({ organizationId: organizationMemberships.organizationId, role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.personId, personId), sql`${organizationMemberships.period} @> CURRENT_DATE`));
  for (const m of currentMemberships) {
    await autoGrantAccessForMemberRole(game, db, m.organizationId, personId, m.role);
  }

  return { ok: true };
}

export async function unlinkUserFromPersonEntry(game: GameSlug, personId: number, actorUserId: string): Promise<LinkUserResult> {
  const { people } = gameTables(game);
  const [person] = await db.select({ id: people.id, userId: people.userId }).from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return { ok: false, error: "notFound" };

  await setPersonUser(db, personId, null);
  await logActivity({ game, subject: "player", subjectId: personId, event: "updated", description: `Unlinked account from player #${personId}`, actorUserId, changes: { userId: { old: person.userId, new: null } } }, db);
  return { ok: true };
}

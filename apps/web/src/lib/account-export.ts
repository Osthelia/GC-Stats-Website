/**
 * GC-Stats - account-export
 *
 * Builds the RGPD data export for a user account: profile, linked social
 * accounts, linked player profile with roster history, and sanctions
 * received.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users, accounts, people, rosterMemberships, teams, sanctions } from "@gc-stats/db";

/**
 * Builds the RGPD data export for one account — mirrors V1's
 * AccountSettingsController::exportData block-by-block (profile,
 * social_accounts, player_profile/teams, sanctions_received). Synchronous,
 * no job: the same shape is small enough to build on request.
 */
export async function buildAccountExport(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      pronouns: users.pronouns,
      bio: users.bio,
      socials: users.socials,
      teamTag: users.teamTag,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const linkedAccounts = await db.select({ provider: accounts.provider, providerAccountId: accounts.providerAccountId }).from(accounts).where(eq(accounts.userId, userId));

  const [person] = await db
    .select({ id: people.id, handle: people.handle, firstName: people.firstName, lastName: people.lastName, countryCode: people.countryCode, bio: people.bio })
    .from(people)
    .where(eq(people.userId, userId))
    .limit(1);

  let rosterHistory: { teamName: string; role: string; period: string }[] = [];
  if (person) {
    const rows = await db
      .select({ teamName: teams.name, role: rosterMemberships.role, period: rosterMemberships.period })
      .from(rosterMemberships)
      .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
      .where(eq(rosterMemberships.personId, person.id));
    rosterHistory = rows;
  }

  const sanctionsReceived = await db
    .select({ type: sanctions.type, reason: sanctions.reason, startsAt: sanctions.startsAt, endsAt: sanctions.endsAt, revokedAt: sanctions.revokedAt })
    .from(sanctions)
    .where(eq(sanctions.userId, userId));

  return {
    exportedAt: new Date().toISOString(),
    profile: user ?? null,
    connectedAccounts: linkedAccounts,
    linkedPlayerProfile: person ? { ...person, rosterHistory } : null,
    sanctionsReceived,
  };
}

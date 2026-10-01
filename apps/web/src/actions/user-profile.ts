/**
 * GC-Stats - user-profile
 *
 * Server actions for a user's own public profile: name, username,
 * pronouns, bio, socials and their "fan of" team.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users, teams } from "@gc-stats/db";
import { visibleTeam } from "@/lib/ghost-visibility";
import { getCurrentUserId } from "@/lib/session";
import { validateUserProfileInput, type UserProfileInput, type UserProfileFieldErrors } from "@/lib/user-profile-validation";

async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

// users.team_id ("fan of" a team) is a real column in the database, deliberately
// absent from the Drizzle schema (schema/auth.ts) to avoid a circular import
// with schema/people.ts (teams) — see the comment on `teams` there. Read/write
// it with raw SQL instead of the query builder for that one column.
async function getUserTeamId(userId: string): Promise<number | null> {
  const result = await db.execute<{ team_id: number | null }>(sql`select team_id from users where id = ${userId} limit 1`);
  return result.rows[0]?.team_id ?? null;
}

export type MyProfileTeam = { id: number; name: string; countryCode: string | null; tags: string[] };

export type MyProfile = {
  name: string;
  username: string;
  pronouns: string; // "" | "0" | "1" | "2"
  bio: string;
  socials: Record<string, string>;
  image: string | null;
  team: MyProfileTeam | null;
  teamTag: string;
};

export async function getMyProfile(): Promise<MyProfile> {
  const userId = await requireUserId();

  const [row, teamId] = await Promise.all([
    db
      .select({ name: users.name, username: users.username, pronouns: users.pronouns, bio: users.bio, teamTag: users.teamTag, socials: users.socials, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0]),
    getUserTeamId(userId),
  ]);
  if (!row) throw new Error("User not found");

  let team: MyProfileTeam | null = null;
  if (teamId !== null) {
    const [teamRow] = await db.select({ id: teams.id, name: teams.name, countryCode: teams.countryCode, tags: teams.tags }).from(teams).where(eq(teams.id, teamId)).limit(1);
    if (teamRow) team = { id: teamRow.id, name: teamRow.name, countryCode: teamRow.countryCode, tags: (teamRow.tags as string[] | null) ?? [] };
  }

  return {
    name: row.name ?? "",
    username: row.username ?? "",
    pronouns: row.pronouns === null ? "" : String(row.pronouns),
    bio: row.bio ?? "",
    socials: (row.socials as Record<string, string>) ?? {},
    image: row.image,
    team,
    teamTag: team ? (row.teamTag ?? "") : "",
  };
}

/** Loads a team's own fan tags (App\Models\Team::tags in V1) — called after the client picks a team in the fan-team picker, before it can offer a tag to select. */
export async function getTeamFanTags(teamId: number): Promise<string[]> {
  const [team] = await db.select({ tags: teams.tags }).from(teams).where(eq(teams.id, teamId)).limit(1);
  return (team?.tags as string[] | null) ?? [];
}

export type UpdateProfileResult = { ok: true; username: string } | { ok: false; fieldErrors: UserProfileFieldErrors };

export async function updateMyProfile(input: UserProfileInput): Promise<UpdateProfileResult> {
  const userId = await requireUserId();

  const { fieldErrors, name, username, pronouns, bio, socials } = validateUserProfileInput(input);

  // Fan team pick: the team must exist, and a chosen tag must be one of
  // that team's own tags (mirrors V1's ProfileSettingsController::updateFanTeam).
  let teamId: number | null = null;
  let teamTag: string | null = null;
  if (input.teamId !== null) {
    const [team] = await db.select({ id: teams.id, tags: teams.tags }).from(teams).where(and(eq(teams.id, input.teamId), visibleTeam)).limit(1);
    if (!team) {
      fieldErrors.teamTag = "invalidTeam";
    } else {
      teamId = team.id;
      const trimmedTag = input.teamTag.trim();
      if (trimmedTag) {
        const tags = (team.tags as string[] | null) ?? [];
        if (!tags.includes(trimmedTag)) fieldErrors.teamTag = "invalidTeamTag";
        else teamTag = trimmedTag;
      }
    }
  }

  if (!fieldErrors.username) {
    const [collision] = await db.select({ id: users.id }).from(users).where(and(eq(users.username, username), ne(users.id, userId))).limit(1);
    if (collision) fieldErrors.username = "taken";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.transaction(async (tx) => {
    await tx.update(users).set({ name, username, pronouns, bio: bio || null, socials }).where(eq(users.id, userId));
    await tx.execute(sql`update users set team_id = ${teamId}, team_tag = ${teamTag} where id = ${userId}`);
  });

  return { ok: true, username };
}

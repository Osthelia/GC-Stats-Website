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
import { adminDb as db } from "@gc-stats/db/client";
import { users, gameTables } from "@gc-stats/db";
import { visibleTeam } from "@/lib/ghost-visibility";
import { getCurrentUserId } from "@/lib/session";
import { diffChanges, logActivity } from "@/lib/activity-log";
import { validateUserProfileInput, type UserProfileInput, type UserProfileFieldErrors } from "@/lib/user-profile-validation";
import { GAMES, isGameSlug, type GameSlug } from "@gc-stats/db/game";
import { FAN_TEAM_COLUMNS } from "@/lib/fan-team-columns";

async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

// The fan team columns ("fan of" a team, one per game) are real columns in the
// database, deliberately absent from the Drizzle schema (schema/auth.ts) to avoid
// a circular import with the game tables. Read/write them with raw SQL instead
// of the query builder.
type FanTeamIds = Record<GameSlug, { teamId: number | null; teamTag: string }>;

async function getUserFanTeamIds(userId: string): Promise<FanTeamIds> {
  const select = GAMES.map((game) => sql`${sql.identifier(FAN_TEAM_COLUMNS[game].team)} as ${sql.identifier(`${game}_team`)}, ${sql.identifier(FAN_TEAM_COLUMNS[game].tag)} as ${sql.identifier(`${game}_tag`)}`);
  const result = await db.execute<Record<string, string | number | null>>(sql`select ${sql.join(select, sql`, `)} from users where id = ${userId} limit 1`);
  const row = result.rows[0];
  const ids = {} as FanTeamIds;
  for (const game of GAMES) {
    // bigint columns come back from node-postgres as strings.
    const teamId = row?.[`${game}_team`];
    ids[game] = { teamId: teamId == null ? null : Number(teamId), teamTag: String(row?.[`${game}_tag`] ?? "") };
  }
  return ids;
}

export type MyProfileTeam = { id: number; name: string; countryCode: string | null; tags: string[] };

export type MyFanTeam = { team: MyProfileTeam | null; teamTag: string };

export type MyProfile = {
  name: string;
  username: string;
  pronouns: string; // "" | "0" | "1" | "2"
  bio: string;
  socials: Record<string, string>;
  image: string | null;
  fanTeams: Record<GameSlug, MyFanTeam>;
};

async function loadFanTeam(game: GameSlug, teamId: number | null, teamTag: string): Promise<MyFanTeam> {
  if (teamId === null) return { team: null, teamTag: "" };
  const { teams } = gameTables(game);
  const [row] = await db.select({ id: teams.id, name: teams.name, countryCode: teams.countryCode, tags: teams.tags }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!row) return { team: null, teamTag: "" };
  return { team: { id: row.id, name: row.name, countryCode: row.countryCode, tags: (row.tags as string[] | null) ?? [] }, teamTag };
}

export async function getMyProfile(): Promise<MyProfile> {
  const userId = await requireUserId();

  const [row, fanIds] = await Promise.all([
    db
      .select({ name: users.name, username: users.username, pronouns: users.pronouns, bio: users.bio, socials: users.socials, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0]),
    getUserFanTeamIds(userId),
  ]);
  if (!row) throw new Error("User not found");

  const loaded = await Promise.all(GAMES.map((game) => loadFanTeam(game, fanIds[game].teamId, fanIds[game].teamTag)));
  const fanTeams = {} as Record<GameSlug, MyFanTeam>;
  GAMES.forEach((game, index) => {
    fanTeams[game] = loaded[index]!;
  });

  return {
    name: row.name ?? "",
    username: row.username ?? "",
    pronouns: row.pronouns === null ? "" : String(row.pronouns),
    bio: row.bio ?? "",
    socials: (row.socials as Record<string, string>) ?? {},
    image: row.image,
    fanTeams,
  };
}

/** Loads a team's own fan tags (App\Models\Team::tags in V1) — called after the client picks a team in the fan-team picker, before it can offer a tag to select. */
export async function getTeamFanTags(game: GameSlug, teamId: number): Promise<string[]> {
  if (!isGameSlug(game)) return [];
  const { teams } = gameTables(game);
  const [team] = await db.select({ tags: teams.tags }).from(teams).where(eq(teams.id, teamId)).limit(1);
  return (team?.tags as string[] | null) ?? [];
}

export type UpdateProfileResult = { ok: true; username: string } | { ok: false; fieldErrors: UserProfileFieldErrors };

export async function updateMyProfile(input: UserProfileInput): Promise<UpdateProfileResult> {
  const userId = await requireUserId();

  const { fieldErrors, name, username, pronouns, bio, socials } = validateUserProfileInput(input);

  // Fan team pick, per game: the team must exist in that game, and a chosen tag must be one of
  // that team's own tags (mirrors V1's ProfileSettingsController::updateFanTeam).
  const picks = {} as Record<GameSlug, { teamId: number | null; teamTag: string | null }>;
  for (const game of GAMES) {
    const { teams } = gameTables(game);
    const pick = input.fanTeams[game] ?? { teamId: null, teamTag: "" };
    picks[game] = { teamId: null, teamTag: null };
    if (pick.teamId === null) continue;
    const [team] = await db.select({ id: teams.id, tags: teams.tags }).from(teams).where(and(eq(teams.id, pick.teamId), visibleTeam(game))).limit(1);
    if (!team) {
      fieldErrors[`teamTag.${game}`] = "invalidTeam";
      continue;
    }
    picks[game].teamId = team.id;
    const trimmedTag = pick.teamTag.trim();
    if (!trimmedTag) continue;
    if (((team.tags as string[] | null) ?? []).includes(trimmedTag)) picks[game].teamTag = trimmedTag;
    else fieldErrors[`teamTag.${game}`] = "invalidTeamTag";
  }

  if (!fieldErrors.username) {
    const [collision] = await db.select({ id: users.id }).from(users).where(and(eq(users.username, username), ne(users.id, userId))).limit(1);
    if (collision) fieldErrors.username = "taken";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [current, currentFan] = await Promise.all([
    db.select({ name: users.name, username: users.username, pronouns: users.pronouns, bio: users.bio, socials: users.socials }).from(users).where(eq(users.id, userId)).limit(1).then((r) => r[0]),
    getUserFanTeamIds(userId),
  ]);

  const fanBefore: Record<string, unknown> = {};
  const fanAfter: Record<string, unknown> = {};
  for (const game of GAMES) {
    fanBefore[`${game}TeamId`] = currentFan[game].teamId;
    fanBefore[`${game}TeamTag`] = currentFan[game].teamTag || null;
    fanAfter[`${game}TeamId`] = picks[game].teamId;
    fanAfter[`${game}TeamTag`] = picks[game].teamTag;
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ name, username, pronouns, bio: bio || null, socials }).where(eq(users.id, userId));
    for (const game of GAMES) {
      const columns = FAN_TEAM_COLUMNS[game];
      await tx.execute(sql`update users set ${sql.identifier(columns.team)} = ${picks[game].teamId}, ${sql.identifier(columns.tag)} = ${picks[game].teamTag} where id = ${userId}`);
    }

    const changes = diffChanges({ ...current, ...fanBefore }, { name, username, pronouns, bio: bio || null, socials, ...fanAfter });
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "user", subjectId: userId, logName: "moderation", event: "updated", description: `Updated profile of user ${username}`, actorUserId: userId, changes, properties: { section: "profile" } }, tx);
    }
  });

  return { ok: true, username };
}

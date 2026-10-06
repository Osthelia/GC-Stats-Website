/**
 * GC-Stats - user-profile-data
 *
 * Read only DB queries backing the public user profile page: profile info,
 * fan team lookup (single and batched), and lightweight profile stats
 * (forum message count, whether the user has published news).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users, teams, forumMessages, newsAuthors, news } from "@gc-stats/db";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { getEntityLogos, getCurrentLogoUrlsThemed, themedLogoUrls } from "@/lib/admin-logos";

export type UserProfileInfo = {
  id: string;
  name: string | null;
  username: string;
  image: string | null;
  pronouns: number | null;
  bio: string | null;
  socials: Record<string, string>;
  isAuthor: boolean;
  createdAt: Date;
};

export const getUserProfileByUsername = cache(async (username: string): Promise<UserProfileInfo | null> => {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      image: users.image,
      pronouns: users.pronouns,
      bio: users.bio,
      socials: users.socials,
      isAuthor: users.isAuthor,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!row || !row.username) return null;

  return { ...row, username: row.username, socials: (row.socials as Record<string, string>) ?? {} };
});

export type UserFanTeam = {
  id: number;
  // Full team name — used for the /team/{id}/{slug} URL, never displayed as is.
  name: string;
  // Short name/tag shown as "Supports {displayName}" when the user has no custom fan tag.
  displayName: string;
  // A fan tag the user picked from the team's own list, shown alone instead
  // of the "Supports" wrapper. Null when they just follow the team plainly.
  tag: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

// users.team_id is a real column, deliberately absent from the Drizzle schema
// (see the comment on `teams` in schema/people.ts and getUserTeamId in
// actions/user-profile.ts) — read with raw SQL instead of the query builder.
export async function getUserFanTeam(userId: string): Promise<UserFanTeam | null> {
  const result = await db.execute<{ team_id: number | null; team_tag: string | null }>(sql`select team_id, team_tag from users where id = ${userId} limit 1`);
  const row = result.rows[0];
  if (!row?.team_id) return null;

  const [team] = await db.select({ id: teams.id, name: teams.name, shortName: teams.shortName }).from(teams).where(eq(teams.id, row.team_id)).limit(1);
  if (!team) return null;

  const logos = await getEntityLogos("team", team.id);
  const themed = themedLogoUrls(logos, "team");

  return { id: team.id, name: team.name, displayName: team.shortName || team.name, tag: row.team_tag || null, logoUrl: themed.dark, logoUrlLight: themed.light };
}

/**
 * Batched `getUserFanTeam` for a page listing many users at once (forum
 * messages) — one raw SQL round trip for team_id/team_tag, one batched team
 * lookup, one batched logo lookup, instead of N of each.
 */
export async function getUserFanTeamsBatch(userIds: string[]): Promise<Map<string, UserFanTeam>> {
  const map = new Map<string, UserFanTeam>();
  const distinctIds = [...new Set(userIds)];
  if (distinctIds.length === 0) return map;

  // team_id is bigint — node-postgres returns it as a string, not a number.
  type UserTeamRow = { id: string; team_id: string | null; team_tag: string | null };
  const result = await db.execute<UserTeamRow>(
    sql`select id, team_id, team_tag from users where id in (${sql.join(
      distinctIds.map((id) => sql`${id}`),
      sql`, `
    )})`
  );
  const rows: UserTeamRow[] = result.rows;
  const rowsWithTeam = rows
    .filter((r): r is { id: string; team_id: string; team_tag: string | null } => r.team_id !== null)
    .map((r) => ({ ...r, team_id: Number(r.team_id) }));
  if (rowsWithTeam.length === 0) return map;

  const teamIds: number[] = [...new Set(rowsWithTeam.map((r) => r.team_id))];
  const teamRows = await db.select({ id: teams.id, name: teams.name, shortName: teams.shortName }).from(teams).where(inArray(teams.id, teamIds));
  const teamsById = new Map(teamRows.map((t) => [t.id, t]));
  const logosByTeam = await getCurrentLogoUrlsThemed("team", teamIds);

  for (const row of rowsWithTeam) {
    const team = teamsById.get(row.team_id);
    if (!team) continue;
    const themed = logosByTeam.get(row.team_id) ?? { dark: null, light: null };
    map.set(row.id, { id: team.id, name: team.name, displayName: team.shortName || team.name, tag: row.team_tag || null, logoUrl: themed.dark, logoUrlLight: themed.light });
  }

  return map;
}

export type UserProfileStats = {
  forumMessageCount: number;
  hasNewsArticles: boolean;
};

/**
 * `UserProfileHeader` only shows the News tab when it has something to show
 * (same explicit-request pattern as PlayerHeader's tab availability) — a
 * cheap existence check, not the full article fetch getUserNewsArticles does.
 */
export async function getUserProfileStats(userId: string): Promise<UserProfileStats> {
  const [[messageRow], [authorRow]] = await Promise.all([
    db
      .select({ c: count() })
      .from(forumMessages)
      .where(and(eq(forumMessages.userId, userId), isNull(forumMessages.hiddenAt), isNull(forumMessages.deletedAt))),
    db.select({ id: newsAuthors.id }).from(newsAuthors).where(eq(newsAuthors.userId, userId)).limit(1),
  ]);

  let hasNewsArticles = false;
  if (authorRow) {
    const [articleRow] = await db
      .select({ id: news.id })
      .from(news)
      .where(and(eq(news.authorId, authorRow.id), isNewsPublishedCondition()))
      .limit(1);
    hasNewsArticles = Boolean(articleRow);
  }

  return { forumMessageCount: Number(messageRow?.c ?? 0), hasNewsArticles };
}

/**
 * GC-Stats - teams
 *
 * Query helpers for the API v2 team endpoints: listing, profile, roster,
 * matches, maps, achievements and press, extending the v1 team queries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { teams, qualificationResults, stageQualifications, entrants, stageContainers, stages, tournaments, news, organizations, newsRelations, matches } from "@gc-stats/db";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { escapeLike } from "../../v1/params";
import { getThemedLogoUrls, getThemedLogoUrlsBatch, type ApiThemedLogoUrls } from "../../v1/logo-response";
import { getTeamPlayers, getTeamMatches, getTeamMaps, type ApiPaginatedTeamMatches, type ApiTeamPlayersResponse, type ApiTeamMapEntry } from "../../v1/queries/teams";
import { toApiTeamV2, type ApiTeamV2 } from "../entities";
import { buildTournamentEntries, type ApiTournamentEntry } from "./entrant-tournaments";
import type { TeamMatchesFilter, TeamMapsFilter, TeamsListFilter } from "../params";
import { visibleTeam } from "@/lib/ghost-visibility";
import { rejectGhost } from "@/lib/api/v1/ghost";

export type ApiAchievementEntry = { tournament_id: number; tournament_name: string; placement: number; placement_label: string | null; end_date: string };
export type ApiAchievementsResponse = { items: ApiAchievementEntry[]; titles: number; podiums: number };

/** Top 3 finishes only — same rule as the public team page (`getTeamAchievements`, lib/team-page-data.ts), duplicated here in the API's own snake_case shape. */
async function getTeamAchievementsV2(teamId: number): Promise<ApiAchievementsResponse> {
  const rows = await db
    .select({
      placement: stageQualifications.placement,
      placementLabel: stageQualifications.placementLabel,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      endDate: tournaments.endDate,
    })
    .from(qualificationResults)
    .innerJoin(stageQualifications, eq(stageQualifications.id, qualificationResults.qualificationId))
    .innerJoin(entrants, eq(entrants.id, qualificationResults.entrantId))
    .leftJoin(matches, eq(matches.id, stageQualifications.sourceMatchId))
    .innerJoin(stageContainers, eq(stageContainers.id, sql`coalesce(${stageQualifications.sourceContainerId}, ${matches.containerId})`))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(and(eq(entrants.teamId, teamId), eq(stageQualifications.destinationType, "placement")))
    .orderBy(desc(tournaments.endDate));

  const items: ApiAchievementEntry[] = rows
    .filter((r): r is typeof r & { placement: number } => r.placement != null && r.placement <= 3)
    .map((r) => ({ tournament_id: r.tournamentId, tournament_name: r.tournamentName, placement: r.placement, placement_label: r.placementLabel, end_date: r.endDate }));

  return { items, titles: items.filter((i) => i.placement === 1).length, podiums: items.length };
}

export type ApiPressEntry = { title: string; slug: string; publisher: string; published_at: string | null; lang: string };

/** No locale filter (unlike the site's `getTeamPress`) — the API has no notion of a visitor locale, every published article is returned with its own `lang`. */
async function getTeamPressV2(teamId: number, limit = 10): Promise<ApiPressEntry[]> {
  const rows = await db
    .select({ title: news.title, slug: news.slug, publisher: organizations.name, publishedAt: news.publishedAt, lang: news.lang })
    .from(newsRelations)
    .innerJoin(news, eq(news.id, newsRelations.newsId))
    .leftJoin(organizations, eq(organizations.id, news.organizationId))
    .where(and(eq(newsRelations.relatableType, "team"), eq(newsRelations.relatableId, teamId), isNewsPublishedCondition()))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  return rows.map((r) => ({ title: r.title, slug: r.slug, publisher: r.publisher ?? "GC-Stats", published_at: r.publishedAt ? r.publishedAt.toISOString() : null, lang: r.lang }));
}

/** Last tournaments the team registered for (one entry per entrant), with final placement and W/L on decided matches. */
async function getTeamLastTournamentsV2(teamId: number, limit = 10): Promise<ApiTournamentEntry[]> {
  const rows = await db
    .select({ entrantId: entrants.id, entrantName: entrants.displayName, tournament: tournaments, team: teams })
    .from(entrants)
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .where(eq(entrants.teamId, teamId))
    .orderBy(desc(tournaments.endDate), desc(tournaments.startDate), desc(tournaments.id), desc(entrants.id))
    .limit(limit);

  return buildTournamentEntries(rows);
}

export type ApiTeamFullResponseV2 = ApiTeamV2 & {
  logos: ApiThemedLogoUrls;
  achievements: ApiAchievementsResponse;
  last_matches: ApiPaginatedTeamMatches;
  current_roster: ApiTeamPlayersResponse["current"];
  last_tournaments: ApiTournamentEntry[];
  press: ApiPressEntry[];
};

const EMPTY_MATCHES: ApiPaginatedTeamMatches = { page: 1, per_page: 20, total: 0, total_pages: 0, data: [] };

async function buildTeamFullResponse(row: typeof teams.$inferSelect): Promise<ApiTeamFullResponseV2> {
  const [logos, achievements, lastMatches, roster, lastTournaments, press] = await Promise.all([
    getThemedLogoUrls("team", row.id),
    getTeamAchievementsV2(row.id),
    getTeamMatches(row.id, { page: 1, perPage: 20 }),
    getTeamPlayers(row.id),
    getTeamLastTournamentsV2(row.id),
    getTeamPressV2(row.id),
  ]);

  return {
    ...toApiTeamV2(row),
    logos,
    achievements,
    last_matches: lastMatches ?? EMPTY_MATCHES,
    current_roster: roster?.current ?? [],
    last_tournaments: lastTournaments,
    press,
  };
}

export async function getTeamByIdV2(id: number): Promise<ApiTeamFullResponseV2 | null> {
  const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  rejectGhost(row, "team");
  if (!row) return null;
  return buildTeamFullResponse(row);
}

export async function searchTeamsByNameV2(query: string): Promise<ApiTeamFullResponseV2[]> {
  const pattern = `${escapeLike(query)}%`;
  const rows = await db
    .select()
    .from(teams)
    .where(and(or(ilike(teams.name, pattern), ilike(teams.shortName, pattern)), visibleTeam))
    .limit(10);

  return Promise.all(rows.map(buildTeamFullResponse));
}

/** First team (by name asc) whose name or short name starts with the given string — the sub endpoints (matches/maps) resolve a single team, unlike the top level `by-name` which returns every match. */
async function resolveTeamIdByName(query: string): Promise<number | null> {
  const pattern = `${escapeLike(query)}%`;
  const [row] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(or(ilike(teams.name, pattern), ilike(teams.shortName, pattern)), visibleTeam))
    .orderBy(teams.name)
    .limit(1);
  return row?.id ?? null;
}

export async function getTeamMatchesV2(teamId: number, filter: TeamMatchesFilter): Promise<ApiPaginatedTeamMatches | null> {
  return getTeamMatches(teamId, filter);
}

export async function getTeamMatchesByNameV2(name: string, filter: TeamMatchesFilter): Promise<ApiPaginatedTeamMatches | null> {
  const teamId = await resolveTeamIdByName(name);
  if (teamId === null) return null;
  return getTeamMatchesV2(teamId, filter);
}

export async function getTeamMapsV2(teamId: number, filter: TeamMapsFilter): Promise<ApiTeamMapEntry[] | null> {
  return getTeamMaps(teamId, filter);
}

export async function getTeamMapsByNameV2(name: string, filter: TeamMapsFilter): Promise<ApiTeamMapEntry[] | null> {
  const teamId = await resolveTeamIdByName(name);
  if (teamId === null) return null;
  return getTeamMapsV2(teamId, filter);
}

export type ApiTeamListEntry = ApiTeamV2 & { logos: ApiThemedLogoUrls };
export type ApiPaginatedTeams = { page: number; per_page: number; total: number; total_pages: number; data: ApiTeamListEntry[] };

/** Global team listing (`/v2/teams`) — a name/short name prefix search plus country/active filters, sorted by name, always paginated. */
export async function listTeamsV2(filter: TeamsListFilter): Promise<ApiPaginatedTeams> {
  const conditions = [];
  if (filter.name) {
    const pattern = `${escapeLike(filter.name)}%`;
    conditions.push(or(ilike(teams.name, pattern), ilike(teams.shortName, pattern)) ?? sql`false`);
  }
  if (filter.countryCode) conditions.push(eq(teams.countryCode, filter.countryCode));
  if (filter.isActive !== undefined) conditions.push(eq(teams.isActive, filter.isActive));
  const where = conditions.length ? and(...conditions) : undefined;

  const orderFn = filter.direction === "desc" ? desc : asc;

  const [countRow, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(teams).where(and(where, visibleTeam)),
    db
      .select()
      .from(teams)
      .where(and(where, visibleTeam))
      .orderBy(orderFn(teams.name))
      .limit(filter.perPage)
      .offset((filter.page - 1) * filter.perPage),
  ]);

  const total = Number(countRow[0]?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / filter.perPage) : 0;
  const logosByTeamId = await getThemedLogoUrlsBatch("team", rows.map((r) => r.id));

  return {
    page: filter.page,
    per_page: filter.perPage,
    total,
    total_pages: totalPages,
    data: rows.map((r) => ({ ...toApiTeamV2(r), logos: logosByTeamId.get(r.id) ?? { dark: null, light: null } })),
  };
}

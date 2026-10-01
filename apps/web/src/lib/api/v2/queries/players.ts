/**
 * GC-Stats - players
 *
 * Query helpers for the API v2 player endpoints: listing, profile, match
 * history, achievements and press, extending the v1 player queries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { people, teams, entrants, matches, maps, mapPlayerStats, stageContainers, stages, tournaments, qualificationResults, stageQualifications, rosterMemberships, news, organizations, newsRelations } from "@gc-stats/db";
import { isNewsPublishedCondition } from "@/lib/news-publish-condition";
import { toApiTeamFromJoined, type ApiTeam } from "../../v1/entities";
import { escapeLike, exclusiveUpperBound } from "../../v1/params";
import { getThemedLogoUrls, getThemedLogoUrlsBatch, themedApiLogoUrlsAt, type ApiThemedLogoUrls } from "../../v1/logo-response";
import { getPlayerTeamHistory, getPlayerStats, PLAYER_ROSTER_ROLES, type ApiPlayerTeamHistory } from "../../v1/queries/players";
import { buildVetosByMatch } from "../../v1/queries/match-vetos";
import type { ApiAvgStats } from "../../v1/avg-stats";
import type { ApiTeamMatchEntry, ApiPaginatedTeamMatches } from "../../v1/queries/teams";
import type { StatsFilter } from "../../v1/params";
import { buildTeamDisplayResolver } from "@/lib/historical-team-display";
import { toApiPlayerV2, type ApiPlayerV2 } from "../entities";
import { buildTournamentEntries, type ApiTournamentEntry, type EntrantTournamentRow, type WinLoss } from "./entrant-tournaments";
import type { ApiAchievementEntry, ApiAchievementsResponse, ApiPressEntry } from "./teams";
import type { PlayersListFilter } from "../params";
import type { PaginationFilter, TeamMatchesFilter } from "../params";
import { visiblePerson } from "@/lib/ghost-visibility";
import { rejectGhost } from "@/lib/api/v1/ghost";

async function personExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: people.id, isGhost: people.isGhost }).from(people).where(eq(people.id, id)).limit(1);
  rejectGhost(row, "player");
  return !!row;
}

/** Same "roster membership open on the tournament's end date" rule as the public player page (`getPlayerAchievements`, lib/player-page-data.ts) — no entrant-level attribution available for players. */
async function getPlayerAchievementsV2(personId: number): Promise<ApiAchievementsResponse> {
  const rows = await db
    .select({
      qualificationId: stageQualifications.id,
      placement: stageQualifications.placement,
      placementLabel: stageQualifications.placementLabel,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      endDate: tournaments.endDate,
    })
    .from(qualificationResults)
    .innerJoin(stageQualifications, eq(stageQualifications.id, qualificationResults.qualificationId))
    .innerJoin(entrants, eq(entrants.id, qualificationResults.entrantId))
    .innerJoin(rosterMemberships, eq(rosterMemberships.teamId, entrants.teamId))
    .leftJoin(matches, eq(matches.id, stageQualifications.sourceMatchId))
    .innerJoin(stageContainers, eq(stageContainers.id, sql`coalesce(${stageQualifications.sourceContainerId}, ${matches.containerId})`))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(
      and(
        eq(rosterMemberships.personId, personId),
        eq(stageQualifications.destinationType, "placement"),
        isNotNull(stageQualifications.placement),
        lte(stageQualifications.placement, 3),
        sql`${rosterMemberships.period} @> ${tournaments.endDate}`,
      ),
    )
    .orderBy(desc(tournaments.endDate));

  const seen = new Set<number>();
  const items: ApiAchievementEntry[] = rows
    .filter((r): r is typeof r & { placement: number } => r.placement != null && (seen.has(r.qualificationId) ? false : (seen.add(r.qualificationId), true)))
    .map((r) => ({ tournament_id: r.tournamentId, tournament_name: r.tournamentName, placement: r.placement, placement_label: r.placementLabel, end_date: r.endDate }));

  return { items, titles: items.filter((i) => i.placement === 1).length, podiums: items.length };
}

/** No locale filter (unlike the site's `getPlayerPress`) — same reasoning as the team endpoint's press list. */
async function getPlayerPressV2(personId: number, limit = 10): Promise<ApiPressEntry[]> {
  const rows = await db
    .select({ title: news.title, slug: news.slug, publisher: organizations.name, publishedAt: news.publishedAt, lang: news.lang })
    .from(newsRelations)
    .innerJoin(news, eq(news.id, newsRelations.newsId))
    .leftJoin(organizations, eq(organizations.id, news.organizationId))
    .where(and(eq(newsRelations.relatableType, "person"), eq(newsRelations.relatableId, personId), isNewsPublishedCondition()))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  return rows.map((r) => ({ title: r.title, slug: r.slug, publisher: r.publisher ?? "GC-Stats", published_at: r.publishedAt ? r.publishedAt.toISOString() : null, lang: r.lang }));
}

const entrantAAlias = alias(entrants, "player_match_entrant_a");
const entrantBAlias = alias(entrants, "player_match_entrant_b");
const teamAAlias = alias(teams, "player_match_team_a");
const teamBAlias = alias(teams, "player_match_team_b");

const EMPTY_MATCHES: ApiPaginatedTeamMatches = { page: 1, per_page: 20, total: 0, total_pages: 0, data: [] };

/**
 * Matches this person is confirmed to have played, resolved from `map_player_stats`
 * (ground truth) rather than roster membership — same limitation as the public
 * player page's `getPlayerMatches` (lib/player-page-data.ts).
 */
async function getPlayerLastMatchesV2(personId: number, perPage = 20): Promise<ApiPaginatedTeamMatches> {
  const playedRows = await db
    .selectDistinct({ id: matches.id, scheduledAt: matches.scheduledAt })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .where(eq(mapPlayerStats.personId, personId))
    .orderBy(desc(matches.scheduledAt), desc(matches.id));

  const total = playedRows.length;
  if (total === 0) return EMPTY_MATCHES;

  const pageIds = playedRows.slice(0, perPage).map((r) => r.id);

  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      label: matches.label,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      bestOf: matches.bestOf,
      patch: matches.patch,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      stageId: stages.id,
      tournamentId: stages.tournamentId,
      teamA: teamAAlias,
      teamB: teamBAlias,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(entrantAAlias, eq(entrantAAlias.id, matches.entrantAId))
    .leftJoin(teamAAlias, eq(teamAAlias.id, entrantAAlias.teamId))
    .leftJoin(entrantBAlias, eq(entrantBAlias.id, matches.entrantBId))
    .leftJoin(teamBAlias, eq(teamBAlias.id, entrantBAlias.teamId))
    .where(inArray(matches.id, pageIds))
    .orderBy(desc(matches.scheduledAt), desc(matches.id));

  const vetosByMatch = await buildVetosByMatch(pageIds);

  const data: ApiTeamMatchEntry[] = rows.map((row) => {
    const teamA = toApiTeamFromJoined(row.teamA);
    const teamB = toApiTeamFromJoined(row.teamB);
    return {
      id: row.id,
      tournament_id: row.tournamentId,
      phase_id: row.stageId,
      round_number: row.round,
      round_name: row.label,
      scheduled_at: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      status: row.status,
      best_of: row.bestOf,
      patch: row.patch,
      team_a: teamA ? { team: teamA, score: row.scoreA } : null,
      team_b: teamB ? { team: teamB, score: row.scoreB } : null,
      vetos: vetosByMatch.get(row.id) ?? [],
    };
  });

  return { page: 1, per_page: perPage, total, total_pages: Math.ceil(total / perPage), data };
}

/** One entry per (tournament, entrant) the player played for, from `map_player_stats`. W/L only counts decided matches the player played in. */
async function getPlayerLastTournamentsV2(personId: number, limit = 10): Promise<ApiTournamentEntry[]> {
  const entrantRows = await db
    .selectDistinct({ entrantId: entrants.id, entrantName: entrants.displayName, tournament: tournaments, team: teams })
    .from(mapPlayerStats)
    .innerJoin(entrants, eq(entrants.id, mapPlayerStats.entrantId))
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .leftJoin(teams, eq(teams.id, entrants.teamId))
    .where(eq(mapPlayerStats.personId, personId))
    .orderBy(desc(tournaments.endDate), desc(tournaments.startDate), desc(tournaments.id))
    .limit(limit);

  if (entrantRows.length === 0) return [];

  const matchRows = await db
    .selectDistinct({ matchId: matches.id, entrantId: mapPlayerStats.entrantId, winnerId: matches.winnerId })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .where(and(eq(mapPlayerStats.personId, personId), inArray(mapPlayerStats.entrantId, entrantRows.map((r) => r.entrantId)), isNotNull(matches.winnerId)));

  const record = new Map<number, WinLoss>();
  for (const m of matchRows) {
    const r = record.get(m.entrantId) ?? { wins: 0, losses: 0 };
    if (m.winnerId === m.entrantId) r.wins++;
    else r.losses++;
    record.set(m.entrantId, r);
  }

  return buildTournamentEntries(entrantRows, record);
}

export type ApiPlayerTeamHistoryV2 = ApiPlayerTeamHistory & { current_name: string; logos: ApiThemedLogoUrls };

function dayBefore(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Past stints carry the team's name and logo as of their last day, `current_name` is always the live name. */
async function getPlayerTeamHistoryV2(personId: number): Promise<ApiPlayerTeamHistoryV2[]> {
  const history = (await getPlayerTeamHistory(personId)) ?? [];
  const resolver = await buildTeamDisplayResolver(history.map((h) => h.team_id));

  return history.map((h) => {
    const lastDay = h.left_at ? dayBefore(h.left_at) : null;
    return {
      ...h,
      team_name: lastDay ? resolver.nameAt(h.team_id, new Date(`${lastDay}T00:00:00.000Z`), h.team_name) : h.team_name,
      current_name: h.team_name,
      logos: themedApiLogoUrlsAt(resolver.logoEntriesOf(h.team_id), lastDay),
    };
  });
}

export type ApiStaffTournamentEntry = ApiTournamentEntry & { roles: string[] };
export type ApiPaginatedStaffTournaments = { page: number; per_page: number; total: number; total_pages: number; data: ApiStaffTournamentEntry[] };

/** Tournaments a team played while this person was on its staff (non player roster role overlapping the tournament dates). W/L is the team's. */
export async function getPlayerStaffTournamentsV2(personId: number, filter: PaginationFilter): Promise<ApiPaginatedStaffTournaments | null> {
  if (!(await personExists(personId))) return null;

  const rows = await db
    .select({ entrantId: entrants.id, entrantName: entrants.displayName, role: rosterMemberships.role, tournament: tournaments, team: teams })
    .from(rosterMemberships)
    .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .innerJoin(entrants, eq(entrants.teamId, rosterMemberships.teamId))
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .where(
      and(
        eq(rosterMemberships.personId, personId),
        notInArray(rosterMemberships.role, [...PLAYER_ROSTER_ROLES]),
        sql`${rosterMemberships.period} && daterange(${tournaments.startDate}, ${tournaments.endDate}, '[]')`,
      ),
    )
    .orderBy(desc(tournaments.endDate), desc(tournaments.startDate), desc(tournaments.id), desc(entrants.id));

  // Several staff roles on the same team can match one entrant
  const byEntrant = new Map<number, { row: EntrantTournamentRow; roles: string[] }>();
  for (const r of rows) {
    const existing = byEntrant.get(r.entrantId);
    if (existing) {
      if (!existing.roles.includes(r.role)) existing.roles.push(r.role);
    } else {
      byEntrant.set(r.entrantId, { row: r, roles: [r.role] });
    }
  }

  const all = [...byEntrant.values()];
  const total = all.length;
  const pageItems = all.slice((filter.page - 1) * filter.perPage, filter.page * filter.perPage);
  const entries = await buildTournamentEntries(pageItems.map((p) => p.row));

  return {
    page: filter.page,
    per_page: filter.perPage,
    total,
    total_pages: total > 0 ? Math.ceil(total / filter.perPage) : 0,
    data: entries.map((e, i) => ({ ...e, roles: pageItems[i]!.roles })),
  };
}

export async function getPlayerStaffTournamentsByNameV2(name: string, filter: PaginationFilter): Promise<ApiPaginatedStaffTournaments | null> {
  const personId = await resolvePersonIdByName(name);
  if (personId === null) return null;
  return getPlayerStaffTournamentsV2(personId, filter);
}

export type ApiPlayerFullResponseV2 = ApiPlayerV2 & {
  logos: ApiThemedLogoUrls;
  achievements: ApiAchievementsResponse;
  last_matches: ApiPaginatedTeamMatches;
  current_teams: ApiPlayerTeamHistoryV2[];
  past_teams: ApiPlayerTeamHistoryV2[];
  last_tournaments: ApiTournamentEntry[];
  press: ApiPressEntry[];
};

async function buildPlayerFullResponse(row: typeof people.$inferSelect): Promise<ApiPlayerFullResponseV2> {
  const [logos, achievements, lastMatches, history, lastTournaments, press] = await Promise.all([
    getThemedLogoUrls("person", row.id),
    getPlayerAchievementsV2(row.id),
    getPlayerLastMatchesV2(row.id),
    getPlayerTeamHistoryV2(row.id),
    getPlayerLastTournamentsV2(row.id),
    getPlayerPressV2(row.id),
  ]);

  return {
    ...toApiPlayerV2(row),
    logos,
    achievements,
    last_matches: lastMatches,
    current_teams: history.filter((t) => t.left_at === null),
    past_teams: history.filter((t) => t.left_at !== null),
    last_tournaments: lastTournaments,
    press,
  };
}

export async function getPlayerByIdV2(id: number): Promise<ApiPlayerFullResponseV2 | null> {
  if (!(await personExists(id))) return null;
  const [row] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  rejectGhost(row, "player");
  if (!row) return null;
  return buildPlayerFullResponse(row);
}

export async function searchPlayersByNameV2(query: string): Promise<ApiPlayerFullResponseV2[]> {
  const pattern = `${escapeLike(query)}%`;
  const rows = await db.select().from(people).where(and(ilike(people.handle, pattern), visiblePerson)).limit(10);

  return Promise.all(rows.map(buildPlayerFullResponse));
}

/** First player (by handle asc) whose handle starts with the given string — the sub endpoints (matches/stats) resolve a single player, unlike the top level `by-name` which returns every match. */
async function resolvePersonIdByName(query: string): Promise<number | null> {
  const pattern = `${escapeLike(query)}%`;
  const [row] = await db.select({ id: people.id }).from(people).where(and(ilike(people.handle, pattern), visiblePerson)).orderBy(people.handle).limit(1);
  return row?.id ?? null;
}

function matchDateConditions(filter: { from?: string; to?: string }) {
  const conditions = [];
  if (filter.from) conditions.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  return conditions;
}

/** Every match id this person played, resolved from `map_player_stats` (ground truth) — same limitation as `getPlayerLastMatchesV2` above. */
async function getPlayerPlayedMatchIds(personId: number, tournamentId?: number): Promise<number[]> {
  const conditions = [eq(mapPlayerStats.personId, personId)];
  if (tournamentId) conditions.push(eq(stages.tournamentId, tournamentId));

  const rows = await db
    .selectDistinct({ id: matches.id })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions));

  return rows.map((r) => r.id);
}

const pagedEntrantAAlias = alias(entrants, "player_paged_entrant_a");
const pagedEntrantBAlias = alias(entrants, "player_paged_entrant_b");
const pagedTeamAAlias = alias(teams, "player_paged_team_a");
const pagedTeamBAlias = alias(teams, "player_paged_team_b");

const EMPTY_PAGED_MATCHES: ApiPaginatedTeamMatches = { page: 1, per_page: 20, total: 0, total_pages: 0, data: [] };

/** Paginated, filterable match history for the player, most recent first — same shape and filters (`opponent_id`/`status`/`phase_id`/`round_name`) as `/v2/teams/{id}/matches`, scoped to matches this person actually played. */
export async function getPlayerMatchesV2(personId: number, filter: TeamMatchesFilter): Promise<ApiPaginatedTeamMatches | null> {
  if (!(await personExists(personId))) return null;

  const playedMatchIds = await getPlayerPlayedMatchIds(personId, filter.tournamentId);
  if (playedMatchIds.length === 0) return { ...EMPTY_PAGED_MATCHES, page: filter.page, per_page: filter.perPage };

  const conditions = [inArray(matches.id, playedMatchIds), ...matchDateConditions(filter)];
  if (filter.status) conditions.push(eq(matches.status, filter.status as "pending" | "live" | "completed"));
  if (filter.roundName) conditions.push(eq(matches.label, filter.roundName));
  if (filter.stageId) conditions.push(eq(stages.id, filter.stageId));

  if (filter.opponentId) {
    const opponentEntrants = await db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, filter.opponentId));
    const opponentIds = opponentEntrants.map((e) => e.id);
    conditions.push(opponentIds.length > 0 ? (or(inArray(matches.entrantAId, opponentIds), inArray(matches.entrantBId, opponentIds)) ?? sql`false`) : sql`false`);
  }

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions));

  const total = Number(countRow?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / filter.perPage) : 0;

  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      label: matches.label,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      bestOf: matches.bestOf,
      patch: matches.patch,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      stageId: stages.id,
      tournamentId: stages.tournamentId,
      teamA: pagedTeamAAlias,
      teamB: pagedTeamBAlias,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(pagedEntrantAAlias, eq(pagedEntrantAAlias.id, matches.entrantAId))
    .leftJoin(pagedTeamAAlias, eq(pagedTeamAAlias.id, pagedEntrantAAlias.teamId))
    .leftJoin(pagedEntrantBAlias, eq(pagedEntrantBAlias.id, matches.entrantBId))
    .leftJoin(pagedTeamBAlias, eq(pagedTeamBAlias.id, pagedEntrantBAlias.teamId))
    .where(and(...conditions))
    .orderBy(desc(matches.scheduledAt), desc(matches.id))
    .limit(filter.perPage)
    .offset((filter.page - 1) * filter.perPage);

  const matchIds = rows.map((r) => r.id);
  const vetosByMatch = await buildVetosByMatch(matchIds);

  const data: ApiTeamMatchEntry[] = rows.map((row) => {
    const teamA = toApiTeamFromJoined(row.teamA);
    const teamB = toApiTeamFromJoined(row.teamB);
    return {
      id: row.id,
      tournament_id: row.tournamentId,
      phase_id: row.stageId,
      round_number: row.round,
      round_name: row.label,
      scheduled_at: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      status: row.status,
      best_of: row.bestOf,
      patch: row.patch,
      team_a: teamA ? { team: teamA, score: row.scoreA } : null,
      team_b: teamB ? { team: teamB, score: row.scoreB } : null,
      vetos: vetosByMatch.get(row.id) ?? [],
    };
  });

  return { page: filter.page, per_page: filter.perPage, total, total_pages: totalPages, data };
}

export async function getPlayerMatchesByNameV2(name: string, filter: TeamMatchesFilter): Promise<ApiPaginatedTeamMatches | null> {
  const personId = await resolvePersonIdByName(name);
  if (personId === null) return null;
  return getPlayerMatchesV2(personId, filter);
}

/** Direct alias of `/v1/players/{id}/stats` — no `round_name`/`phase_id` narrowing added (unlike the tournament/team endpoints): a single player's per round split isn't a filter anyone asked for, `tournament_id` already covers the useful case. */
export async function getPlayerStatsV2(personId: number, filter: StatsFilter): Promise<ApiAvgStats | null> {
  return getPlayerStats(personId, filter);
}

export async function getPlayerStatsByNameV2(name: string, filter: StatsFilter): Promise<ApiAvgStats | null> {
  const personId = await resolvePersonIdByName(name);
  if (personId === null) return null;
  return getPlayerStatsV2(personId, filter);
}

export type ApiPlayerListEntry = ApiPlayerV2 & { logos: ApiThemedLogoUrls };
export type ApiPaginatedPlayers = { page: number; per_page: number; total: number; total_pages: number; data: ApiPlayerListEntry[] };

/** Global player listing (`/v2/players`) — a handle prefix search plus country/active filters, sorted by handle, always paginated. */
export async function listPlayersV2(filter: PlayersListFilter): Promise<ApiPaginatedPlayers> {
  const conditions = [];
  if (filter.handle) conditions.push(ilike(people.handle, `${escapeLike(filter.handle)}%`));
  if (filter.countryCode) conditions.push(eq(people.countryCode, filter.countryCode));
  if (filter.isActive !== undefined) conditions.push(eq(people.isActive, filter.isActive));
  const where = conditions.length ? and(...conditions) : undefined;

  const orderFn = filter.direction === "desc" ? desc : asc;

  const [countRow, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(people).where(and(where, visiblePerson)),
    db
      .select()
      .from(people)
      .where(and(where, visiblePerson))
      .orderBy(orderFn(people.handle))
      .limit(filter.perPage)
      .offset((filter.page - 1) * filter.perPage),
  ]);

  const total = Number(countRow[0]?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / filter.perPage) : 0;
  const logosByPersonId = await getThemedLogoUrlsBatch("person", rows.map((r) => r.id));

  return {
    page: filter.page,
    per_page: filter.perPage,
    total,
    total_pages: totalPages,
    data: rows.map((r) => ({ ...toApiPlayerV2(r), logos: logosByPersonId.get(r.id) ?? { dark: null, light: null } })),
  };
}

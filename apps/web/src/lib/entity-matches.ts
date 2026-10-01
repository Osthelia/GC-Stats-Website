/**
 * GC-Stats - entity-matches
 *
 * Match list of one team or one player (Overview and Matches tabs), with
 * that entity always on side "a". Every filter, the status counts and the
 * pagination run in SQL.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { entrants, matches, maps, mapPlayerStats, stageContainers, stages, teams, tournaments } from "@gc-stats/db";
import { buildTeamDisplayResolver } from "@/lib/historical-team-display";
import { normalizeRegion } from "@/lib/home-fake-data";
import { abbreviateTournamentName, type HomeMatch } from "@/lib/home-data";
import { formatSideScore } from "@/lib/match-score-format";
import { visibleTeam, visibleTournament } from "@/lib/ghost-visibility";

export const ENTITY_MATCHES_PAGE_SIZE = 20;

export type EntityMatchStatusFilter = "live" | "upcoming" | "finished";
export type EntityMatchStatusCounts = Record<"all" | EntityMatchStatusFilter, number>;
export type EntityMatchesFilters = {
  tournamentId?: number;
  opponentTeamId?: number;
  result?: "win" | "loss" | "draw";
  status?: EntityMatchStatusFilter;
};
export type EntityMatchesFilterOptions = { tournaments: { id: number; name: string }[]; opponents: { id: number; name: string }[] };

/** Whose matches: a team (any of its entrants) or a player (matches with recorded stats). */
export type MatchEntity = { kind: "team"; id: number } | { kind: "player"; id: number };

type DbMatchStatus = "pending" | "live" | "completed";

const STATUS_FROM_DB: Record<DbMatchStatus, HomeMatch["status"]> = { pending: "upcoming", live: "live", completed: "finished" };
const STATUS_TO_DB: Record<EntityMatchStatusFilter, DbMatchStatus> = { upcoming: "pending", live: "live", finished: "completed" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Parses the Matches tab query params, each one a value picked from a known list. */
export function parseEntityMatchesFilters(searchParams: Record<string, string | string[] | undefined>): EntityMatchesFilters {
  const tournamentId = Number(firstParam(searchParams.tournament));
  const opponentTeamId = Number(firstParam(searchParams.opponent));
  const result = firstParam(searchParams.result);
  const status = firstParam(searchParams.status);

  return {
    tournamentId: Number.isInteger(tournamentId) && tournamentId > 0 ? tournamentId : undefined,
    opponentTeamId: Number.isInteger(opponentTeamId) && opponentTeamId > 0 ? opponentTeamId : undefined,
    result: result === "win" || result === "loss" || result === "draw" ? result : undefined,
    status: status === "live" || status === "upcoming" || status === "finished" ? status : undefined,
  };
}

/** Matches tab URL for the given filters, page 1 unless `page` is set. */
export function entityMatchesHref(basePath: string, filters: EntityMatchesFilters, page = 1): string {
  const qs = new URLSearchParams();
  if (filters.tournamentId != null) qs.set("tournament", String(filters.tournamentId));
  if (filters.opponentTeamId != null) qs.set("opponent", String(filters.opponentTeamId));
  if (filters.result) qs.set("result", filters.result);
  if (filters.status) qs.set("status", filters.status);
  if (page !== 1) qs.set("page", String(page));
  const s = qs.toString();
  return `${basePath}${s ? `?${s}` : ""}`;
}

/** One link per status tab, keeping the other filters. */
export function entityMatchesStatusHrefs(basePath: string, filters: EntityMatchesFilters): Record<"all" | EntityMatchStatusFilter, string> {
  return {
    all: entityMatchesHref(basePath, { ...filters, status: undefined }),
    live: entityMatchesHref(basePath, { ...filters, status: "live" }),
    upcoming: entityMatchesHref(basePath, { ...filters, status: "upcoming" }),
    finished: entityMatchesHref(basePath, { ...filters, status: "finished" }),
  };
}

const oppEntrant = alias(entrants, "opp_entrant");
const selfEntrant = alias(entrants, "self_entrant");

/** The entity's own entrant for each of its matches. Null when a team has no entrant at all. */
async function selfMatchesSubquery(entity: MatchEntity) {
  if (entity.kind === "player") {
    return db
      .selectDistinctOn([maps.matchId], {
        matchId: sql<number>`${maps.matchId}`.mapWith(Number).as("self_match_id"),
        entrantId: sql<number>`${mapPlayerStats.entrantId}`.mapWith(Number).as("self_entrant_id"),
      })
      .from(mapPlayerStats)
      .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
      .where(eq(mapPlayerStats.personId, entity.id))
      .orderBy(maps.matchId)
      .as("self_matches");
  }

  const teamEntrantIds = (await db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, entity.id))).map((e) => e.id);
  if (teamEntrantIds.length === 0) return null;
  const isA = inArray(matches.entrantAId, teamEntrantIds);
  return db
    .select({
      matchId: sql<number>`${matches.id}`.mapWith(Number).as("self_match_id"),
      entrantId: sql<number>`case when ${isA} then ${matches.entrantAId} else ${matches.entrantBId} end`.mapWith(Number).as("self_entrant_id"),
    })
    .from(matches)
    .where(or(isA, inArray(matches.entrantBId, teamEntrantIds)))
    .as("self_matches");
}

/** One row per match of the entity, both sides resolved. */
async function entityMatchesSubquery(entity: MatchEntity) {
  const self = await selfMatchesSubquery(entity);
  if (!self) return null;

  const selfIsA = sql`${matches.entrantAId} = ${self.entrantId}`;
  const opponentEntrantId = sql<number | null>`case when ${selfIsA} then ${matches.entrantBId} else ${matches.entrantAId} end`;

  return db
    .select({
      id: matches.id,
      status: sql<DbMatchStatus>`${matches.status}`.as("status"),
      scheduledAt: matches.scheduledAt,
      bestOf: matches.bestOf,
      label: matches.label,
      tournamentId: sql<number>`${tournaments.id}`.mapWith(Number).as("tournament_id"),
      tournamentName: sql<string>`${tournaments.name}`.as("tournament_name"),
      region: tournaments.region,
      selfEntrantId: self.entrantId,
      selfScore: sql<number | null>`case when ${selfIsA} then ${matches.scoreA} else ${matches.scoreB} end`.as("self_score"),
      selfTeamId: sql<number | null>`${selfEntrant.teamId}`.mapWith(Number).as("self_team_id"),
      selfDisplayName: sql<string | null>`${selfEntrant.displayName}`.as("self_display_name"),
      opponentEntrantId: opponentEntrantId.mapWith(Number).as("opponent_entrant_id"),
      opponentScore: sql<number | null>`case when ${selfIsA} then ${matches.scoreB} else ${matches.scoreA} end`.as("opponent_score"),
      opponentTeamId: sql<number | null>`${oppEntrant.teamId}`.mapWith(Number).as("opponent_team_id"),
      opponentDisplayName: sql<string | null>`${oppEntrant.displayName}`.as("opponent_display_name"),
    })
    .from(self)
    .innerJoin(matches, eq(matches.id, self.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .leftJoin(selfEntrant, eq(selfEntrant.id, self.entrantId))
    .leftJoin(oppEntrant, eq(oppEntrant.id, opponentEntrantId))
    .as("entity_matches");
}

type EntityMatchesSq = NonNullable<Awaited<ReturnType<typeof entityMatchesSubquery>>>;

/** Every filter except `status`, which the status counts ignore. */
function baseConditions(m: EntityMatchesSq, filters: EntityMatchesFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.tournamentId != null) conditions.push(eq(m.tournamentId, filters.tournamentId));
  if (filters.opponentTeamId != null) conditions.push(eq(m.opponentTeamId, filters.opponentTeamId));
  if (filters.result === "win") conditions.push(sql`${m.status} <> 'pending' and ${m.selfScore} > ${m.opponentScore}`);
  if (filters.result === "loss") conditions.push(sql`${m.status} <> 'pending' and ${m.selfScore} < ${m.opponentScore}`);
  if (filters.result === "draw") {
    conditions.push(sql`${m.status} = 'completed' and (${m.selfScore} is null or ${m.opponentScore} is null or ${m.selfScore} = ${m.opponentScore})`);
  }
  return conditions;
}

type EntityMatchesQuery = {
  filters?: EntityMatchesFilters;
  statuses?: DbMatchStatus[];
  /** Only matches scheduled at or after this date, soonest first. */
  scheduledFrom?: Date;
  limit: number;
  offset?: number;
};

export async function getEntityMatches(entity: MatchEntity, opts: EntityMatchesQuery): Promise<HomeMatch[]> {
  const m = await entityMatchesSubquery(entity);
  if (!m) return [];
  return fetchMatches(m, opts);
}

async function fetchMatches(m: EntityMatchesSq, opts: EntityMatchesQuery): Promise<HomeMatch[]> {
  const filters = opts.filters ?? {};
  const conditions = baseConditions(m, filters);
  const statuses = filters.status ? [STATUS_TO_DB[filters.status]] : opts.statuses;
  if (statuses) conditions.push(inArray(m.status, statuses));
  if (opts.scheduledFrom) conditions.push(gte(m.scheduledAt, opts.scheduledFrom));

  const rows = await db
    .select()
    .from(m)
    .where(and(...conditions))
    .orderBy(...(opts.scheduledFrom ? [asc(m.scheduledAt), asc(m.id)] : [desc(m.scheduledAt), desc(m.id)]))
    .limit(opts.limit)
    .offset(opts.offset ?? 0);
  if (rows.length === 0) return [];

  const teamIds = rows.flatMap((r) => [r.selfTeamId, r.opponentTeamId]).filter((id): id is number => id != null);
  const resolver = await buildTeamDisplayResolver(teamIds);

  const side = (teamId: number | null, displayName: string | null, at: Date) => {
    if (displayName == null) return { name: "?", tag: "?", logoUrl: null, logoUrlLight: null };
    if (teamId == null) return { name: displayName, tag: "?", logoUrl: null, logoUrlLight: null };
    const logos = resolver.logosAt(teamId, at);
    return { name: resolver.nameAt(teamId, at, displayName), tag: resolver.shortNameOf(teamId) ?? "?", logoUrl: logos.dark, logoUrlLight: logos.light };
  };

  return rows.map((r) => {
    const at = r.scheduledAt ?? new Date();
    const a = side(r.selfTeamId, r.selfDisplayName, at);
    const b = side(r.opponentTeamId, r.opponentDisplayName, at);
    const status = STATUS_FROM_DB[r.status] ?? "upcoming";
    const leader =
      status === "upcoming" || r.selfScore == null || r.opponentScore == null || r.selfScore === r.opponentScore ? null : r.selfScore > r.opponentScore ? "a" : "b";

    return {
      id: r.id,
      status,
      time: r.scheduledAt ? r.scheduledAt.toISOString().slice(11, 16) : "",
      format: `BO${r.bestOf}`,
      region: normalizeRegion(r.region),
      aName: a.name,
      aTag: a.tag,
      aScore: formatSideScore(r.selfScore, r.selfEntrantId),
      aLogoUrl: a.logoUrl,
      aLogoUrlLight: a.logoUrlLight,
      bName: b.name,
      bTag: b.tag,
      bScore: formatSideScore(r.opponentScore, r.opponentEntrantId),
      bLogoUrl: b.logoUrl,
      bLogoUrlLight: b.logoUrlLight,
      leader,
      event: abbreviateTournamentName(r.tournamentName),
      stage: r.label ?? "",
      scheduledAt: r.scheduledAt ?? new Date(0),
    };
  });
}

/** Matches tab: one page plus the per status counts (counts follow every filter except the status one). */
export async function getEntityMatchesPage(
  entity: MatchEntity,
  opts: { filters: EntityMatchesFilters; page: number },
): Promise<{ items: HomeMatch[]; counts: EntityMatchStatusCounts; total: number }> {
  const counts: EntityMatchStatusCounts = { all: 0, live: 0, upcoming: 0, finished: 0 };
  const m = await entityMatchesSubquery(entity);
  if (!m) return { items: [], counts, total: 0 };

  const [items, countRows] = await Promise.all([
    fetchMatches(m, { filters: opts.filters, limit: ENTITY_MATCHES_PAGE_SIZE, offset: (opts.page - 1) * ENTITY_MATCHES_PAGE_SIZE }),
    db
      .select({ status: m.status, count: sql<number>`count(*)::int` })
      .from(m)
      .where(and(...baseConditions(m, opts.filters)))
      .groupBy(m.status),
  ]);

  for (const row of countRows) {
    counts.all += row.count;
    counts[STATUS_FROM_DB[row.status] ?? "upcoming"] += row.count;
  }
  return { items, counts, total: opts.filters.status ? counts[opts.filters.status] : counts.all };
}

/** Real known values for the Matches tab dropdowns: tournaments played and opposing teams faced. */
export async function getEntityMatchesFilterOptions(entity: MatchEntity): Promise<EntityMatchesFilterOptions> {
  const m = await entityMatchesSubquery(entity);
  if (!m) return { tournaments: [], opponents: [] };

  const [tournamentRows, opponentRows] = await Promise.all([
    db
      .selectDistinct({ id: m.tournamentId, name: m.tournamentName })
      .from(m)
      .innerJoin(tournaments, and(eq(tournaments.id, m.tournamentId), visibleTournament))
      .orderBy(m.tournamentName),
    db.selectDistinct({ id: teams.id, name: teams.name }).from(m).innerJoin(teams, and(eq(teams.id, m.opponentTeamId), visibleTeam)).orderBy(teams.name),
  ]);

  return { tournaments: tournamentRows, opponents: opponentRows };
}

/**
 * GC-Stats - tournament-page-data
 *
 * Public tournament page data: participants and rosters (locked roster
 * first, falling back to players with recorded stats), matches with
 * filters, and stats table rows/metadata for the tournament stats tab.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, gte, inArray, isNotNull, lte, or, sql, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { entrants, entrantMembers, people, teams, matches, maps, stageContainers, stages, tournaments, mapPlayerStats } from "@gc-stats/db";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { normalizeRegion } from "@/lib/tournament-regions";
import { formatSideScore } from "@/lib/match-score-format";
import type { HomeMatch } from "@/lib/home-data";
import type { EntityMatchStatusFilter as MatchStatusFilter } from "@/lib/entity-matches";
import type { ParsedStatsFilters } from "@/lib/stats-filters";
import { resolveDateBounds } from "@/lib/stats-filters";
import { resolveEntrantQualificationSources, type EntrantQualificationSource } from "@/lib/entrant-qualification-source";

export type TournamentRosterPlayer = { personId: number; handle: string };

export type TournamentParticipant = {
  entrantId: number;
  teamId: number | null;
  displayName: string;
  shortName: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
  seed: number | null;
  qualificationSource: EntrantQualificationSource | null;
  roster: TournamentRosterPlayer[];
};

/**
 * Participating entrants + their roster for this tournament, scoped to a
 * single stage (`stageId`) when given — entrants only ever belong to a
 * tournament in the schema (never to a stage/container directly), so
 * "this stage's entrants" is derived from actual participation: seeded into
 * one of the stage's group containers (`group_entries`) or appearing in one
 * of its matches (`matches.entrant_a_id`/`entrant_b_id`, covers bracket
 * containers, which never get a `group_entries` row). Explicit user request:
 * the panel used to show every entrant ever registered for the tournament
 * regardless of which stage/container was selected (e.g. a Group Stage
 * dropout still listed under Playoffs).
 *
 * Roster source mirrors the priority documented in SUIVI.md ("Décisions
 * prises (entrants...)"): `entrant_members` (the locked-for-this-tournament
 * roster) first, falling back to the players who actually have recorded
 * stats for the entrant (`map_player_stats`) — the same signal V1's
 * tournament page used (it never had a per-tournament roster table at all)
 * — for tournaments migrated from V1, which never populated
 * `entrant_members` (see the migration README: "roster figé par tournoi,
 * pas de reconstruction fiable possible").
 */
export async function getTournamentParticipants(tournamentId: number, stageId?: number | null): Promise<TournamentParticipant[]> {
  let stageCondition;
  if (stageId != null) {
    const stageMatchRows = await db
      .select({ a: matches.entrantAId, b: matches.entrantBId })
      .from(matches)
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .where(and(eq(stageContainers.stageId, stageId), or(isNotNull(matches.entrantAId), isNotNull(matches.entrantBId))));
    const stageEntrantIds = [...new Set(stageMatchRows.flatMap((m) => [m.a, m.b]).filter((id): id is number => id != null))];
    if (stageEntrantIds.length > 0) stageCondition = inArray(entrants.id, stageEntrantIds);
  }

  const entrantRows = await db
    .select({
      id: entrants.id,
      teamId: entrants.teamId,
      displayName: entrants.displayName,
      seed: entrants.seed,
      shortName: teams.shortName,
      qualificationSourceManual: entrants.qualificationSourceManual,
      qualificationSourceType: entrants.qualificationSourceType,
      qualificationSourceTournamentId: entrants.qualificationSourceTournamentId,
      qualificationSourcePointTypeId: entrants.qualificationSourcePointTypeId,
    })
    .from(entrants)
    .leftJoin(teams, eq(teams.id, entrants.teamId))
    .where(and(eq(entrants.tournamentId, tournamentId), stageCondition))
    .orderBy(sql`${entrants.seed} nulls last`, entrants.id);

  if (entrantRows.length === 0) return [];

  const entrantIds = entrantRows.map((e) => e.id);
  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id != null))];
  const [logosByTeamId, sourceByEntrant, lockedRows] = await Promise.all([
    getCurrentLogoUrlsThemed("team", teamIds),
    resolveEntrantQualificationSources(db, tournamentId, entrantRows),
    db
      .select({ entrantId: entrantMembers.entrantId, personId: people.id, handle: people.handle })
      .from(entrantMembers)
      .innerJoin(people, eq(people.id, entrantMembers.personId))
      .where(and(inArray(entrantMembers.entrantId, entrantIds), eq(entrantMembers.isStarter, true)))
      .orderBy(people.handle),
  ]);

  const entrantIdsWithLockedRoster = new Set(lockedRows.map((r) => r.entrantId));
  const fallbackEntrantIds = entrantIds.filter((id) => !entrantIdsWithLockedRoster.has(id));

  const fallbackRows = fallbackEntrantIds.length
    ? await db
        .selectDistinct({ entrantId: mapPlayerStats.entrantId, personId: people.id, handle: people.handle })
        .from(mapPlayerStats)
        .innerJoin(people, eq(people.id, mapPlayerStats.personId))
        .where(inArray(mapPlayerStats.entrantId, fallbackEntrantIds))
        .orderBy(people.handle)
    : [];

  const rosterByEntrant = new Map<number, TournamentRosterPlayer[]>();
  for (const r of [...lockedRows, ...fallbackRows]) {
    if (!rosterByEntrant.has(r.entrantId)) rosterByEntrant.set(r.entrantId, []);
    rosterByEntrant.get(r.entrantId)!.push({ personId: r.personId, handle: r.handle });
  }

  return entrantRows.map((e) => ({
    entrantId: e.id,
    teamId: e.teamId,
    displayName: e.displayName,
    shortName: e.shortName,
    logoUrl: e.teamId ? (logosByTeamId.get(e.teamId)?.dark ?? null) : null,
    logoUrlLight: e.teamId ? (logosByTeamId.get(e.teamId)?.light ?? null) : null,
    seed: e.seed,
    qualificationSource: sourceByEntrant.get(e.id) ?? null,
    roster: rosterByEntrant.get(e.id) ?? [],
  }));
}

const TOURNAMENT_MATCH_STATUS: Record<string, HomeMatch["status"]> = { pending: "upcoming", live: "live", completed: "finished" };

export type TournamentMatchStatus = "pending" | "live" | "completed";

/** Overview tab: only played/in-progress matches, capped short, live first. */
export async function getTournamentRecentMatches(tournamentId: number, limit = 9): Promise<HomeMatch[]> {
  return getTournamentMatches(tournamentId, { statuses: ["completed", "live"], limit, liveFirst: true });
}

export type TournamentMatchesFilters = { stageId?: number; round?: string; teamId?: number; map?: string; status?: MatchStatusFilter; sort?: "oldest" };

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Parses the Matches tab's V1-style filter query params (`stage`/`round`/`team`/`map`) — each a single real value picked from a dropdown of known options, not free text, so a plain `Number`/string read is enough (no free-text sanitizing needed here; every DB condition built from these still goes through Drizzle's parameterized `eq`/`inArray`). */
export function parseTournamentMatchesFilters(searchParams: Record<string, string | string[] | undefined>): TournamentMatchesFilters {
  const stageRaw = firstParam(searchParams.stage);
  const teamRaw = firstParam(searchParams.team);
  const round = firstParam(searchParams.round)?.trim();
  const map = firstParam(searchParams.map)?.trim();
  const status = firstParam(searchParams.status);
  const stageId = stageRaw ? Number(stageRaw) : undefined;
  const teamId = teamRaw ? Number(teamRaw) : undefined;

  return {
    stageId: Number.isInteger(stageId) ? stageId : undefined,
    teamId: Number.isInteger(teamId) ? teamId : undefined,
    round: round || undefined,
    map: map || undefined,
    sort: firstParam(searchParams.sort) === "oldest" ? "oldest" : undefined,
    status: status === "live" || status === "upcoming" || status === "finished" ? status : undefined,
  };
}

/**
 * Matches tab: every match, narrowed by `statuses` or the `status` filter. Same `HomeMatch` shape as the home feed and team/player pages
 * so `MatchCard`/`RecentMatchesPanel`/`MatchesList` render it unchanged
 * (component reuse rule). Unlike `getTeamMatches`, there's no "our side"
 * here: entrant A/B keep their natural match order. The right-hand column
 * shows the bracket container (e.g. "Upper Bracket") + round label instead
 * of the tournament name (redundant — this list is already scoped to one
 * tournament).
 */
export const TOURNAMENT_MATCHES_PAGE_SIZE = 20;

const STATUS_TO_DB: Record<MatchStatusFilter, TournamentMatchStatus> = { upcoming: "pending", live: "live", finished: "completed" };

/** Every Matches tab filter except `status`, which the status counts ignore. */
function buildTournamentMatchesConditions(tournamentId: number, filters?: TournamentMatchesFilters) {
  const conditions = [eq(stages.tournamentId, tournamentId)];
  if (filters?.stageId != null) conditions.push(eq(stages.id, filters.stageId));
  if (filters?.round) conditions.push(eq(matches.label, filters.round));
  if (filters?.teamId != null) {
    const teamEntrantIds = db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.tournamentId, tournamentId), eq(entrants.teamId, filters.teamId)));
    conditions.push(or(inArray(matches.entrantAId, teamEntrantIds), inArray(matches.entrantBId, teamEntrantIds))!);
  }
  if (filters?.map) {
    // "Played" maps only (isCompleted), not veto picks/bans.
    conditions.push(inArray(matches.id, db.select({ id: maps.matchId }).from(maps).where(and(eq(maps.isCompleted, true), eq(maps.mapName, filters.map)))));
  }
  return conditions;
}

/** Matches tab: per status counts for the current filters (the status filter itself aside). */
export async function getTournamentMatchesStatusCounts(tournamentId: number, filters?: TournamentMatchesFilters): Promise<Record<"all" | MatchStatusFilter, number>> {
  const rows = await db
    .select({ status: matches.status, count: sql<number>`count(*)::int` })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...buildTournamentMatchesConditions(tournamentId, filters)))
    .groupBy(matches.status);

  const counts = { all: 0, live: 0, upcoming: 0, finished: 0 };
  for (const r of rows) {
    counts.all += r.count;
    counts[TOURNAMENT_MATCH_STATUS[r.status] ?? "upcoming"] += r.count;
  }
  return counts;
}

const entrantA = alias(entrants, "entrant_a");
const entrantB = alias(entrants, "entrant_b");
const teamA = alias(teams, "team_a");
const teamB = alias(teams, "team_b");

export async function getTournamentMatches(
  tournamentId: number,
  opts: { statuses?: TournamentMatchStatus[]; limit?: number; liveFirst?: boolean; filters?: TournamentMatchesFilters; page?: number } = {},
): Promise<HomeMatch[]> {
  const conditions = buildTournamentMatchesConditions(tournamentId, opts.filters);
  const statuses = opts.filters?.status ? [STATUS_TO_DB[opts.filters.status]] : opts.statuses;
  if (statuses) conditions.push(inArray(matches.status, statuses));

  const baseQuery = db
    .select({
      id: matches.id,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      bestOf: matches.bestOf,
      label: matches.label,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      containerName: stageContainers.name,
      region: tournaments.region,
      aName: entrantA.displayName,
      aTeamId: entrantA.teamId,
      aShortName: teamA.shortName,
      bName: entrantB.displayName,
      bTeamId: entrantB.teamId,
      bShortName: teamB.shortName,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
    .leftJoin(teamA, eq(teamA.id, entrantA.teamId))
    .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
    .leftJoin(teamB, eq(teamB.id, entrantB.teamId))
    .where(and(...conditions))
    // Live first, then most recently played (overview panel only, via `liveFirst`) — the full matches tab just sorts by date, same as `getTeamMatches`.
    .orderBy(...(opts.liveFirst ? [sql`case when ${matches.status} = 'live' then 0 else 1 end`, desc(matches.scheduledAt)] : [opts.filters?.sort === "oldest" ? asc(matches.scheduledAt) : desc(matches.scheduledAt)]), opts.filters?.sort === "oldest" ? asc(matches.id) : desc(matches.id));

  let rows: Awaited<typeof baseQuery>;
  if (opts.page != null) {
    rows = await baseQuery.limit(TOURNAMENT_MATCHES_PAGE_SIZE).offset((opts.page - 1) * TOURNAMENT_MATCHES_PAGE_SIZE);
  } else if (opts.limit) {
    rows = await baseQuery.limit(opts.limit);
  } else {
    rows = await baseQuery;
  }

  if (rows.length === 0) return [];

  const teamIds = [...new Set(rows.flatMap((r) => [r.aTeamId, r.bTeamId]).filter((id): id is number => id != null))];
  const logosByTeamId = await getCurrentLogoUrlsThemed("team", teamIds);
  const side = (name: string | null, teamId: number | null, shortName: string | null) =>
    name === null
      ? { name: "?", tag: "?", logoUrl: null, logoUrlLight: null }
      : {
          name,
          tag: teamId ? (shortName ?? "?") : "?",
          logoUrl: teamId ? (logosByTeamId.get(teamId)?.dark ?? null) : null,
          logoUrlLight: teamId ? (logosByTeamId.get(teamId)?.light ?? null) : null,
        };

  return rows.map((r) => {
    const a = side(r.aName, r.aTeamId, r.aShortName);
    const b = side(r.bName, r.bTeamId, r.bShortName);
    const status = TOURNAMENT_MATCH_STATUS[r.status] ?? "upcoming";
    const leader = status === "upcoming" || r.scoreA == null || r.scoreB == null || r.scoreA === r.scoreB ? null : r.scoreA > r.scoreB ? "a" : "b";

    return {
      id: r.id,
      status,
      time: r.scheduledAt ? r.scheduledAt.toISOString().slice(11, 16) : "",
      format: `BO${r.bestOf}`,
      region: normalizeRegion(r.region),
      aName: a.name,
      aTag: a.tag,
      aScore: formatSideScore(r.scoreA, r.entrantAId),
      aLogoUrl: a.logoUrl,
      aLogoUrlLight: a.logoUrlLight,
      bName: b.name,
      bTag: b.tag,
      bScore: formatSideScore(r.scoreB, r.entrantBId),
      bLogoUrl: b.logoUrl,
      bLogoUrlLight: b.logoUrlLight,
      leader,
      event: r.containerName,
      stage: r.label ?? "",
      scheduledAt: r.scheduledAt ?? new Date(0),
    };
  });
}

export type TournamentMatchesFilterOptions = {
  stages: { id: number; name: string }[];
  rounds: string[];
  teams: { id: number; name: string }[];
  maps: string[];
};

/**
 * Real known values for each Matches tab dropdown (V1 parity — simple
 * pre-populated `<select>`-style pickers, not free text): the tournament's
 * own stages ("phase"), every distinct round label actually used, every
 * registered team, and every map actually played (completed maps only).
 */
export async function getTournamentMatchesFilterOptions(tournamentId: number): Promise<TournamentMatchesFilterOptions> {
  const [stageRows, roundRows, teamRows, mapRows] = await Promise.all([
    db.select({ id: stages.id, name: stages.name }).from(stages).where(eq(stages.tournamentId, tournamentId)).orderBy(stages.sequenceOrder),
    db
      .selectDistinct({ label: matches.label })
      .from(matches)
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .where(and(eq(stages.tournamentId, tournamentId), isNotNull(matches.label))),
    db
      .select({ id: entrants.teamId, name: entrants.displayName })
      .from(entrants)
      .where(and(eq(entrants.tournamentId, tournamentId), isNotNull(entrants.teamId)))
      .orderBy(sql`${entrants.seed} nulls last`, entrants.id),
    db
      .selectDistinct({ mapName: maps.mapName })
      .from(maps)
      .innerJoin(matches, eq(matches.id, maps.matchId))
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .where(and(eq(stages.tournamentId, tournamentId), eq(maps.isCompleted, true), isNotNull(maps.mapName))),
  ]);

  return {
    stages: stageRows,
    rounds: roundRows.map((r) => r.label).filter((l): l is string => !!l).sort(),
    teams: teamRows.filter((r): r is { id: number; name: string } => r.id != null),
    maps: mapRows.map((r) => r.mapName).filter((m): m is string => !!m).sort(),
  };
}

/** Distinct agents/maps played in this tournament — feeds the stats page filter dropdowns. */
export async function getTournamentStatsFilterOptions(tournamentId: number): Promise<{ agents: string[]; maps: string[] }> {
  const tournamentMaps = (fields: { value: typeof mapPlayerStats.agentName | typeof maps.mapName }) =>
    db
      .selectDistinct(fields)
      .from(mapPlayerStats)
      .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
      .innerJoin(matches, eq(matches.id, maps.matchId))
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .where(and(eq(stages.tournamentId, tournamentId), isNotNull(fields.value)));

  const [agentRows, mapRows] = await Promise.all([tournamentMaps({ value: mapPlayerStats.agentName }), tournamentMaps({ value: maps.mapName })]);

  return {
    agents: agentRows.map((r) => r.value).filter((a): a is string => !!a).sort(),
    maps: mapRows.map((r) => r.value).filter((m): m is string => !!m).sort(),
  };
}

/** Rows of the tournament stats page (players only), as a subquery for `aggregateMapPlayerStatsSql`. */
export function tournamentStatsScope(tournamentId: number, filters: ParsedStatsFilters): SQLWrapper {
  const { from, to } = resolveDateBounds(filters);

  const conditions = [eq(stages.tournamentId, tournamentId), isNotNull(mapPlayerStats.personId)];
  if (filters.agent) conditions.push(eq(mapPlayerStats.agentName, filters.agent));
  if (filters.map) conditions.push(eq(maps.mapName, filters.map));
  if (from) conditions.push(gte(maps.startedAt, from));
  if (to) conditions.push(lte(maps.startedAt, to));

  return db
    .select({ id: mapPlayerStats.id })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions));
}

export type TournamentStatsPlayerMeta = { agents: string[]; teamId: number | null; teamName: string | null; logoUrl: string | null; logoUrlLight: string | null };

/**
 * Per-player "Agent"/"Team" columns for the tournament stats table (V1
 * parity, `public/tournament/stats.blade.php`'s `played_agents` + implicit
 * team from `game_player_stats.team_id`), over the same rows as the stats
 * aggregation (`scope`). A player who appeared under
 * two different entrants in the tournament (rare, e.g. a mid-event roster
 * swap) is attributed to whichever one they have the most map rows for,
 * per explicit user decision.
 */
export async function getTournamentStatsPlayerMeta(scope: SQLWrapper): Promise<Map<number, TournamentStatsPlayerMeta>> {
  const [agentRows, entrantRows] = await Promise.all([
    db
      .selectDistinct({ personId: mapPlayerStats.personId, agentName: mapPlayerStats.agentName })
      .from(mapPlayerStats)
      .where(and(inArray(mapPlayerStats.id, scope), isNotNull(mapPlayerStats.agentName))),
    // Entrant with the most map rows per player, lowest id on a tie.
    db
      .selectDistinctOn([mapPlayerStats.personId], { personId: mapPlayerStats.personId, id: entrants.id, teamId: entrants.teamId, displayName: entrants.displayName })
      .from(mapPlayerStats)
      .innerJoin(entrants, eq(entrants.id, mapPlayerStats.entrantId))
      .where(inArray(mapPlayerStats.id, scope))
      .groupBy(mapPlayerStats.personId, entrants.id)
      .orderBy(mapPlayerStats.personId, desc(sql`count(*)`), entrants.id),
  ]);

  const agentsByPerson = new Map<number, string[]>();
  for (const r of agentRows) {
    if (r.personId == null || !r.agentName) continue;
    const agents = agentsByPerson.get(r.personId);
    if (agents) agents.push(r.agentName);
    else agentsByPerson.set(r.personId, [r.agentName]);
  }
  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id != null))];
  const logosByTeamId = await getCurrentLogoUrlsThemed("team", teamIds);

  const result = new Map<number, TournamentStatsPlayerMeta>();
  for (const entrant of entrantRows) {
    if (entrant.personId == null) continue;
    const personId = entrant.personId;
    result.set(personId, {
      agents: (agentsByPerson.get(personId) ?? []).sort(),
      teamId: entrant.teamId,
      teamName: entrant.displayName,
      logoUrl: entrant.teamId != null ? (logosByTeamId.get(entrant.teamId)?.dark ?? null) : null,
      logoUrlLight: entrant.teamId != null ? (logosByTeamId.get(entrant.teamId)?.light ?? null) : null,
    });
  }
  return result;
}

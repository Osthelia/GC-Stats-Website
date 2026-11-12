/**
 * GC-Stats - tournament-page-data
 *
 * Public tournament page data: participants and rosters (locked roster
 * first, falling back to players with recorded stats), matches with
 * filters, and stats table rows/metadata for the tournament stats tab
 * (Valorant per map, LoL per game).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, count, desc, eq, exists, gte, inArray, isNotNull, lte, or, sql, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { gameTables, leagueTablesOf, valorantTablesOf } from "@gc-stats/db";
import { buildChampionStatRows, compareByLanes, sortPatchesNewestFirst, type ChampionStatRow, type LeagueRole } from "@gc-stats/lol-stats-engine";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { getChampionIconLookup } from "@/lib/data-dragon-client";
import { normalizeRegion } from "@/lib/tournament-regions";
import { formatSideScore } from "@/lib/match-score-format";
import type { HomeMatch } from "@/lib/home-data";
import type { EntityMatchStatusFilter as MatchStatusFilter } from "@/lib/entity-matches";
import type { LeagueStatsFilters, ParsedStatsFilters } from "@/lib/stats-filters";
import { resolveDateBounds } from "@/lib/stats-filters";
import { resolveEntrantQualificationSources, type EntrantQualificationSource } from "@/lib/entrant-qualification-source";
import { gameHasLanes, gameHasMaps, type GameSlug } from "@gc-stats/db/game";
import { getTournamentLanes } from "@/lib/roster-lanes";

/** `lanes` (Top to Support) is League only, empty for Valorant. */
export type TournamentRosterPlayer = { personId: number; handle: string; lanes: LeagueRole[] };

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

async function mapFallbackRoster(game: GameSlug, entrantIds: number[]) {
  const { people } = gameTables(game);
  const { mapPlayerStats } = valorantTablesOf(game);
  return db
    .selectDistinct({ entrantId: mapPlayerStats.entrantId, personId: people.id, handle: people.handle })
    .from(mapPlayerStats)
    .innerJoin(people, eq(people.id, mapPlayerStats.personId))
    .where(inArray(mapPlayerStats.entrantId, entrantIds))
    .orderBy(people.handle);
}

async function gameFallbackRoster(game: GameSlug, entrantIds: number[]) {
  const { people } = gameTables(game);
  const { gamePlayerStats } = leagueTablesOf(game);
  return db
    .selectDistinct({ entrantId: gamePlayerStats.entrantId, personId: people.id, handle: people.handle })
    .from(gamePlayerStats)
    .innerJoin(people, eq(people.id, gamePlayerStats.personId))
    .where(inArray(gamePlayerStats.entrantId, entrantIds))
    .orderBy(people.handle);
}

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
 * stats for the entrant (`map_player_stats`, or `lol_game_player_stats` for LoL) — the same signal V1's
 * tournament page used (it never had a per-tournament roster table at all)
 * — for tournaments migrated from V1, which never populated
 * `entrant_members` (see the migration README: "roster figé par tournoi,
 * pas de reconstruction fiable possible").
 */
export async function getTournamentParticipants(game: GameSlug, tournamentId: number, stageId?: number | null): Promise<TournamentParticipant[]> {
  const { entrants, entrantMembers, people, teams, matches, stageContainers, tournaments } = gameTables(game);
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
  const [logosByTeamId, sourceByEntrant, lockedRows, [tournament]] = await Promise.all([
    getCurrentLogoUrlsThemed("team", teamIds, game),
    resolveEntrantQualificationSources(game, db, tournamentId, entrantRows),
    db
      .select({ entrantId: entrantMembers.entrantId, personId: people.id, handle: people.handle })
      .from(entrantMembers)
      .innerJoin(people, eq(people.id, entrantMembers.personId))
      .where(and(inArray(entrantMembers.entrantId, entrantIds), eq(entrantMembers.isStarter, true)))
      .orderBy(people.handle),
    // League lanes of a roster before its first game come from the roster entries covering the start date.
    gameHasLanes(game) ? db.select({ startDate: tournaments.startDate }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1) : Promise.resolve([]),
  ]);

  const entrantIdsWithLockedRoster = new Set(lockedRows.map((r) => r.entrantId));
  const fallbackEntrantIds = entrantIds.filter((id) => !entrantIdsWithLockedRoster.has(id));

  // Without a locked roster, the roster is whoever has played for the entrant: the players of its maps or of its games.
  const fallbackRows = fallbackEntrantIds.length === 0 ? [] : gameHasMaps(game) ? await mapFallbackRoster(game, fallbackEntrantIds) : await gameFallbackRoster(game, fallbackEntrantIds);

  // League rosters show the lanes of each player, ordered Top to Support.
  const rosterRows = [...lockedRows, ...fallbackRows];
  let lanesByEntrantAndPerson = new Map<string, LeagueRole[]>();
  if (tournament && rosterRows.length > 0) {
    const teamIdByEntrant = new Map(entrantRows.map((e) => [e.id, e.teamId]));
    lanesByEntrantAndPerson = await getTournamentLanes(tournamentId, tournament.startDate, rosterRows.map((r) => ({ entrantId: r.entrantId, teamId: teamIdByEntrant.get(r.entrantId) ?? null, personId: r.personId })));
  }

  const rosterByEntrant = new Map<number, TournamentRosterPlayer[]>();
  for (const r of rosterRows) {
    if (!rosterByEntrant.has(r.entrantId)) rosterByEntrant.set(r.entrantId, []);
    rosterByEntrant.get(r.entrantId)!.push({ personId: r.personId, handle: r.handle, lanes: lanesByEntrantAndPerson.get(`${r.entrantId}:${r.personId}`) ?? [] });
  }
  for (const roster of rosterByEntrant.values()) roster.sort((a, b) => compareByLanes(a.lanes, b.lanes));

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
export async function getTournamentRecentMatches(game: GameSlug, tournamentId: number, limit = 9): Promise<HomeMatch[]> {
  return getTournamentMatches(game, tournamentId, { statuses: ["completed", "live"], limit, liveFirst: true });
}

export type TournamentMatchesFilters = { stageId?: number; round?: string; teamId?: number; map?: string; status: MatchStatusFilter | "all"; sort?: "oldest" };

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
    status: status === "all" || status === "live" || status === "finished" ? status : "upcoming",
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

// "upcoming" also lists live matches, shown first
const STATUS_TO_DB: Record<MatchStatusFilter, TournamentMatchStatus[]> = { upcoming: ["live", "pending"], live: ["live"], finished: ["completed"] };

/** Every Matches tab filter except `status`, which the status counts ignore. */
function buildTournamentMatchesConditions(game: GameSlug, tournamentId: number, filters?: TournamentMatchesFilters) {
  const { entrants, matches, stages } = gameTables(game);
  const conditions = [eq(stages.tournamentId, tournamentId)];
  // Un match sans aucune team assignée n'est pas affiché
  const entrantTeamIds = db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.tournamentId, tournamentId), isNotNull(entrants.teamId)));
  conditions.push(or(inArray(matches.entrantAId, entrantTeamIds), inArray(matches.entrantBId, entrantTeamIds))!);
  if (filters?.stageId != null) conditions.push(eq(stages.id, filters.stageId));
  if (filters?.round) conditions.push(eq(matches.label, filters.round));
  if (filters?.teamId != null) {
    const teamEntrantIds = db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.tournamentId, tournamentId), eq(entrants.teamId, filters.teamId)));
    conditions.push(or(inArray(matches.entrantAId, teamEntrantIds), inArray(matches.entrantBId, teamEntrantIds))!);
  }
  if (filters?.map && gameHasMaps(game)) {
    const { maps } = valorantTablesOf(game);
    // "Played" maps only (isCompleted), not veto picks/bans.
    conditions.push(inArray(matches.id, db.select({ id: maps.matchId }).from(maps).where(and(eq(maps.isCompleted, true), eq(maps.mapName, filters.map)))));
  }
  return conditions;
}

/** Matches tab: per status counts for the current filters (the status filter itself aside). */
export async function getTournamentMatchesStatusCounts(game: GameSlug, tournamentId: number, filters?: TournamentMatchesFilters): Promise<Record<"all" | MatchStatusFilter, number>> {
  const { matches, stageContainers, stages } = gameTables(game);
  const rows = await db
    .select({ status: matches.status, count: sql<number>`count(*)::int` })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...buildTournamentMatchesConditions(game, tournamentId, filters)))
    .groupBy(matches.status);

  const counts = { all: 0, live: 0, upcoming: 0, finished: 0 };
  for (const r of rows) {
    counts.all += r.count;
    counts[TOURNAMENT_MATCH_STATUS[r.status] ?? "upcoming"] += r.count;
    if (r.status === "live") counts.upcoming += r.count;
  }
  return counts;
}

function entrantA(game: GameSlug) {
  const { entrants } = gameTables(game);
  return alias(entrants, "entrant_a");
}
function entrantB(game: GameSlug) {
  const { entrants } = gameTables(game);
  return alias(entrants, "entrant_b");
}
function teamA(game: GameSlug) {
  const { teams } = gameTables(game);
  return alias(teams, "team_a");
}
function teamB(game: GameSlug) {
  const { teams } = gameTables(game);
  return alias(teams, "team_b");
}

export async function getTournamentMatches(
  game: GameSlug, tournamentId: number,
  opts: { statuses?: TournamentMatchStatus[]; limit?: number; liveFirst?: boolean; filters?: TournamentMatchesFilters; page?: number } = {},
): Promise<HomeMatch[]> {
  const { matches, stageContainers, stages, tournaments } = gameTables(game);
  const conditions = buildTournamentMatchesConditions(game, tournamentId, opts.filters);
  const statuses = opts.filters && opts.filters.status !== "all" ? STATUS_TO_DB[opts.filters.status] : opts.statuses;
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
      aName: entrantA(game).displayName,
      aTeamId: entrantA(game).teamId,
      aShortName: teamA(game).shortName,
      bName: entrantB(game).displayName,
      bTeamId: entrantB(game).teamId,
      bShortName: teamB(game).shortName,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .leftJoin(entrantA(game), eq(entrantA(game).id, matches.entrantAId))
    .leftJoin(teamA(game), eq(teamA(game).id, entrantA(game).teamId))
    .leftJoin(entrantB(game), eq(entrantB(game).id, matches.entrantBId))
    .leftJoin(teamB(game), eq(teamB(game).id, entrantB(game).teamId))
    .where(and(...conditions))
    // Overview panel (`liveFirst`): live first, then latest. Matches tab: default is the closest to now (past or future), "oldest" is the farthest.
    .orderBy(
      ...(opts.liveFirst
        ? [sql`case when ${matches.status} = 'live' then 0 else 1 end`, desc(matches.scheduledAt)]
        : [...(opts.filters?.status === "upcoming" ? [sql`case when ${matches.status} = 'live' then 0 else 1 end`] : []), opts.filters?.sort === "oldest" ? sql`abs(extract(epoch from (${matches.scheduledAt} - now()))) desc nulls last` : sql`abs(extract(epoch from (${matches.scheduledAt} - now()))) asc nulls last`]),
      opts.filters?.sort === "oldest" ? asc(matches.id) : desc(matches.id),
    );

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
  const logosByTeamId = await getCurrentLogoUrlsThemed("team", teamIds, game);
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
export async function getTournamentMatchesFilterOptions(game: GameSlug, tournamentId: number): Promise<TournamentMatchesFilterOptions> {
  const { entrants, matches, stageContainers, stages } = gameTables(game);
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
    gameHasMaps(game)
      ? (async () => {
          const { maps } = valorantTablesOf(game);
          return db
            .selectDistinct({ mapName: maps.mapName })
            .from(maps)
            .innerJoin(matches, eq(matches.id, maps.matchId))
            .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
            .innerJoin(stages, eq(stages.id, stageContainers.stageId))
            .where(and(eq(stages.tournamentId, tournamentId), eq(maps.isCompleted, true), isNotNull(maps.mapName)));
        })()
      : Promise.resolve([] as { mapName: string | null }[]),
  ]);

  return {
    stages: stageRows,
    rounds: roundRows.map((r) => r.label).filter((l): l is string => !!l).sort(),
    teams: teamRows.filter((r): r is { id: number; name: string } => r.id != null),
    maps: mapRows.map((r) => r.mapName).filter((m): m is string => !!m).sort(),
  };
}

/** Distinct agents/maps played in this tournament — feeds the stats page filter dropdowns. */
export async function getTournamentStatsFilterOptions(game: GameSlug, tournamentId: number): Promise<{ agents: string[]; maps: string[] }> {
  const { matches, stageContainers, stages } = gameTables(game);
  const { maps, mapPlayerStats } = valorantTablesOf(game);
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
export function tournamentStatsScope(game: GameSlug, tournamentId: number, filters: ParsedStatsFilters): SQLWrapper {
  const { matches, stageContainers, stages } = gameTables(game);
  const { maps, mapPlayerStats } = valorantTablesOf(game);
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
export async function getTournamentStatsPlayerMeta(game: GameSlug, scope: SQLWrapper): Promise<Map<number, TournamentStatsPlayerMeta>> {
  const { entrants } = gameTables(game);
  const { mapPlayerStats } = valorantTablesOf(game);
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
  const logosByTeamId = await getCurrentLogoUrlsThemed("team", teamIds, game);

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

export type LeagueStatsPlayerMeta = {
  champions: { name: string; iconUrl: string | null }[];
  teamId: number | null;
  teamName: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

function tournamentGameIds(game: GameSlug, tournamentId: number, options: { patch?: string } = {}) {
  const { matches, stageContainers, stages } = gameTables(game);
  const { games, gamePlayerStats } = leagueTablesOf(game);

  const conditions = [
    eq(stages.tournamentId, tournamentId),
    eq(games.isCompleted, true),
    exists(db.select({ id: gamePlayerStats.id }).from(gamePlayerStats).where(eq(gamePlayerStats.gameId, games.id))),
  ];
  if (options.patch) conditions.push(eq(matches.patch, options.patch));

  return db
    .select({ id: games.id })
    .from(games)
    .innerJoin(matches, eq(matches.id, games.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions));
}

/** Rows of the LoL tournament stats page (players only), as a subquery for `aggregateLeaguePlayerStatsSql`. */
export function leagueStatsScope(game: GameSlug, tournamentId: number, filters: LeagueStatsFilters): SQLWrapper {
  const { gamePlayerStats } = leagueTablesOf(game);

  const conditions = [inArray(gamePlayerStats.gameId, tournamentGameIds(game, tournamentId, { patch: filters.patch })), isNotNull(gamePlayerStats.personId)];
  if (filters.champion) conditions.push(eq(gamePlayerStats.championName, filters.champion));
  if (filters.role) conditions.push(eq(gamePlayerStats.role, filters.role));

  return db.select({ id: gamePlayerStats.id }).from(gamePlayerStats).where(and(...conditions));
}

/** The champions played in the tournament, for the stats page dropdown. */
export async function getTournamentChampionNames(game: GameSlug, tournamentId: number): Promise<string[]> {
  const { gamePlayerStats } = leagueTablesOf(game);
  const rows = await db
    .selectDistinct({ value: gamePlayerStats.championName })
    .from(gamePlayerStats)
    .where(inArray(gamePlayerStats.gameId, tournamentGameIds(game, tournamentId)));
  return rows.map((r) => r.value).sort();
}

export async function getTournamentPatches(game: GameSlug, tournamentId: number): Promise<string[]> {
  const { matches } = gameTables(game);
  const { games } = leagueTablesOf(game);
  const rows = await db
    .selectDistinct({ patch: matches.patch })
    .from(games)
    .innerJoin(matches, eq(matches.id, games.matchId))
    .where(and(inArray(games.id, tournamentGameIds(game, tournamentId)), isNotNull(matches.patch)));
  return sortPatchesNewestFirst(rows.map((r) => r.patch!));
}

/**
 * The "Champions" and "Team" columns of the tournament stats table, over the same rows as the stats aggregation
 * (`scope`). A player who appeared under two entrants is attributed to the one they have the most game rows for.
 */
export async function getLeagueStatsPlayerMeta(game: GameSlug, scope: SQLWrapper): Promise<Map<number, LeagueStatsPlayerMeta>> {
  const { entrants } = gameTables(game);
  const { gamePlayerStats } = leagueTablesOf(game);
  const played = count();
  const [championRows, entrantRows, iconUrlOf] = await Promise.all([
    db
      .select({ personId: gamePlayerStats.personId, championName: gamePlayerStats.championName, played })
      .from(gamePlayerStats)
      .where(inArray(gamePlayerStats.id, scope))
      .groupBy(gamePlayerStats.personId, gamePlayerStats.championName)
      .orderBy(desc(played), gamePlayerStats.championName),
    // Entrant with the most game rows per player, lowest id on a tie.
    db
      .selectDistinctOn([gamePlayerStats.personId], { personId: gamePlayerStats.personId, id: entrants.id, teamId: entrants.teamId, displayName: entrants.displayName })
      .from(gamePlayerStats)
      .innerJoin(entrants, eq(entrants.id, gamePlayerStats.entrantId))
      .where(inArray(gamePlayerStats.id, scope))
      .groupBy(gamePlayerStats.personId, entrants.id)
      .orderBy(gamePlayerStats.personId, desc(count()), entrants.id),
    getChampionIconLookup(),
  ]);

  const championsByPerson = new Map<number, { name: string; iconUrl: string | null }[]>();
  for (const r of championRows) {
    if (r.personId == null) continue;
    const champion = { name: r.championName, iconUrl: iconUrlOf(r.championName) };
    const champions = championsByPerson.get(r.personId);
    if (champions) champions.push(champion);
    else championsByPerson.set(r.personId, [champion]);
  }
  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id != null))];
  const logosByTeamId = await getCurrentLogoUrlsThemed("team", teamIds, game);

  const result = new Map<number, LeagueStatsPlayerMeta>();
  for (const entrant of entrantRows) {
    if (entrant.personId == null) continue;
    result.set(entrant.personId, {
      champions: championsByPerson.get(entrant.personId) ?? [],
      teamId: entrant.teamId,
      teamName: entrant.displayName,
      logoUrl: entrant.teamId != null ? (logosByTeamId.get(entrant.teamId)?.dark ?? null) : null,
      logoUrlLight: entrant.teamId != null ? (logosByTeamId.get(entrant.teamId)?.light ?? null) : null,
    });
  }
  return result;
}

export type TournamentChampionStats = { rows: ChampionStatRow[]; iconUrls: Record<string, string | null> };

export async function getTournamentChampionStats(game: GameSlug, tournamentId: number, filters: Pick<LeagueStatsFilters, "role" | "patch">): Promise<TournamentChampionStats> {
  const { games, gamePlayerStats, gameDraft } = leagueTablesOf(game);
  const gameIds = tournamentGameIds(game, tournamentId, { patch: filters.patch });

  const pickConditions = [inArray(gamePlayerStats.gameId, gameIds)];
  if (filters.role) pickConditions.push(eq(gamePlayerStats.role, filters.role));
  const sum = (expr: SQLWrapper) => sql<number>`coalesce(sum(${expr}), 0)::int`;

  const [gameCount, pickRows, banRows, iconUrlOf] = await Promise.all([
    db.select({ games: count() }).from(games).where(inArray(games.id, gameIds)),
    db
      .select({
        championName: gamePlayerStats.championName,
        picks: sql<number>`count(*)::int`,
        wins: sum(sql`case when ${games.winnerEntrantId} = ${gamePlayerStats.entrantId} then 1 else 0 end`),
        kills: sum(gamePlayerStats.kills),
        deaths: sum(gamePlayerStats.deaths),
        assists: sum(gamePlayerStats.assists),
        roles: sql<string[]>`coalesce(array_agg(distinct ${gamePlayerStats.role}) filter (where ${gamePlayerStats.role} is not null), '{}')`,
      })
      .from(gamePlayerStats)
      .innerJoin(games, eq(games.id, gamePlayerStats.gameId))
      .where(and(...pickConditions))
      .groupBy(gamePlayerStats.championName),
    db
      .select({ championName: gameDraft.championName, bans: sql<number>`count(*)::int` })
      .from(gameDraft)
      .where(and(inArray(gameDraft.gameId, gameIds), eq(gameDraft.type, "ban")))
      .groupBy(gameDraft.championName),
    getChampionIconLookup(),
  ]);

  // With a role, only the champions picked in it: a ban has no role, so a champion only banned doesn't belong to one.
  // Their bans and presence still count every role.
  const rows = buildChampionStatRows(pickRows, banRows, gameCount[0]?.games ?? 0).filter((row) => !filters.role || row.totals.picks > 0);
  const iconUrls: Record<string, string | null> = {};
  for (const row of rows) iconUrls[row.groupKey] = iconUrlOf(row.groupKey);
  return { rows, iconUrls };
}

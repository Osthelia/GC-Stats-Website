/**
 * GC-Stats - avg-stats
 *
 * Computes average per-map stats split by side (atk/def) for a team or
 * player scope, shared by the /teams/{id}/stats and /players/{id}/stats
 * v1 endpoints.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { gameTables, valorantTables, valorantTablesOf } from "@gc-stats/db";
import { playerRoundsPlayedSql, sumFloat } from "@/lib/stats-aggregate-sql";
import { exclusiveUpperBound, type StatsFilter } from "./params";
import { ratedRoundsSql, roundRating, weightedRatingSql } from "./rating";
import type { GameSlug } from "@gc-stats/db/game";

/** Who an aggregate stats query is scoped to — a team (any of its entrants across tournaments) or a single player. */
export type EntityScope = { kind: "team"; entrantIds: number[] } | { kind: "player"; personId: number };

export type ApiSideStats = {
  side: "atk" | "def";
  rounds_played: number;
  rounds_won: number;
  round_winrate: number;
  total_kills: number;
  avg_kills_per_round: number;
  total_assists: number;
  avg_assists_per_round: number;
  total_score: number;
  avg_acs_per_round: number;
  total_damage: number;
  avg_adr_per_round: number;
  total_headshots: number;
  total_bodyshots: number;
  total_legshots: number;
  headshot_percentage: number;
  first_kills: number;
  first_deaths: number;
};

export type ApiAvgStats = {
  maps_played: number;
  rounds_played: number;
  total_kills: number;
  avg_kills: number;
  total_deaths: number;
  avg_deaths: number;
  total_assists: number;
  avg_assists: number;
  total_acs: number;
  avg_acs: number;
  total_adr: number;
  avg_adr: number;
  total_kast_percentage: number;
  avg_kast_percentage: number;
  total_headshot_percentage: number;
  avg_headshot_percentage: number;
  total_first_kills: number;
  avg_first_kills: number;
  total_first_deaths: number;
  avg_first_deaths: number;
  kd_ratio: number;
  avg_rating: number | null;
  rating_rounds: number | null;
  by_side: { atk: ApiSideStats; def: ApiSideStats };
};

function isEmptyTeamScope(scope: EntityScope): boolean {
  return scope.kind === "team" && scope.entrantIds.length === 0;
}

function mapPlayerStatsScopeCondition(scope: EntityScope): SQL {
  const { mapPlayerStats } = valorantTables;
  return scope.kind === "team" ? inArray(mapPlayerStats.entrantId, scope.entrantIds) : eq(mapPlayerStats.personId, scope.personId);
}

function baseFilterConditions(game: GameSlug, filter: StatsFilter): SQL[] {
  const { matches, stages } = gameTables(game);
  const { mapPlayerStats } = valorantTablesOf(game);
  const conditions: SQL[] = [];
  if (filter.from) conditions.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  if (filter.tournamentId) conditions.push(eq(stages.tournamentId, filter.tournamentId));
  if (filter.agent) conditions.push(eq(mapPlayerStats.agentName, filter.agent));
  return conditions;
}

const ZERO_SIDE = (side: "atk" | "def"): ApiSideStats => ({
  side,
  rounds_played: 0,
  rounds_won: 0,
  round_winrate: 0,
  total_kills: 0,
  avg_kills_per_round: 0,
  total_assists: 0,
  avg_assists_per_round: 0,
  total_score: 0,
  avg_acs_per_round: 0,
  total_damage: 0,
  avg_adr_per_round: 0,
  total_headshots: 0,
  total_bodyshots: 0,
  total_legshots: 0,
  headshot_percentage: 0,
  first_kills: 0,
  first_deaths: 0,
});

const ZERO_AVG_STATS: ApiAvgStats = {
  maps_played: 0,
  rounds_played: 0,
  total_kills: 0,
  avg_kills: 0,
  total_deaths: 0,
  avg_deaths: 0,
  total_assists: 0,
  avg_assists: 0,
  total_acs: 0,
  avg_acs: 0,
  total_adr: 0,
  avg_adr: 0,
  total_kast_percentage: 0,
  avg_kast_percentage: 0,
  total_headshot_percentage: 0,
  avg_headshot_percentage: 0,
  total_first_kills: 0,
  avg_first_kills: 0,
  total_first_deaths: 0,
  avg_first_deaths: 0,
  kd_ratio: 0,
  avg_rating: null,
  rating_rounds: null,
  by_side: { atk: ZERO_SIDE("atk"), def: ZERO_SIDE("def") },
};

function roundScopeSql(scope: EntityScope): SQL {
  return scope.kind === "team" ? sql`ps.entrant_id = ANY(${sql.param(scope.entrantIds)}::bigint[])` : sql`ps.person_id = ${scope.personId}`;
}

function rawFilterSql(filter: StatsFilter): SQL {
  const parts: SQL[] = [];
  if (filter.from) parts.push(sql`AND m.scheduled_at >= ${new Date(`${filter.from}T00:00:00.000Z`)}`);
  if (filter.to) parts.push(sql`AND m.scheduled_at < ${exclusiveUpperBound(filter.to)}`);
  if (filter.tournamentId) parts.push(sql`AND st.tournament_id = ${filter.tournamentId}`);
  if (filter.agent) parts.push(sql`AND mps.agent_name = ${filter.agent}`);
  return sql.join(parts, sql` `);
}

type SideStatsRow = {
  rounds_played: number;
  rounds_won: number;
  total_kills: number;
  avg_kills_per_round: number;
  total_assists: number;
  avg_assists_per_round: number;
  total_score: number;
  avg_acs_per_round: number;
  total_damage: number;
  avg_adr_per_round: number;
  total_headshots: number;
  total_bodyshots: number;
  total_legshots: number;
};

async function fetchSideStats(scope: EntityScope, filter: StatsFilter, side: "atk" | "def"): Promise<ApiSideStats> {
  if (isEmptyTeamScope(scope)) return ZERO_SIDE(side);

  const sideEntrantCol = side === "atk" ? sql`r.atk_entrant_id` : sql`r.def_entrant_id`;

  const result = await db.execute<SideStatsRow>(sql`
    SELECT
      COUNT(*)::int AS rounds_played,
      COALESCE(SUM(CASE WHEN r.winning_entrant_id = ps.entrant_id THEN 1 ELSE 0 END), 0)::int AS rounds_won,
      COALESCE(SUM(ps.kills), 0)::int AS total_kills,
      COALESCE(AVG(ps.kills), 0)::float8 AS avg_kills_per_round,
      COALESCE(SUM(ps.assists), 0)::int AS total_assists,
      COALESCE(AVG(ps.assists), 0)::float8 AS avg_assists_per_round,
      COALESCE(SUM(ps.score), 0)::int AS total_score,
      COALESCE(AVG(ps.score), 0)::float8 AS avg_acs_per_round,
      COALESCE(SUM(d.damage), 0)::int AS total_damage,
      COALESCE(AVG(COALESCE(d.damage, 0)), 0)::float8 AS avg_adr_per_round,
      COALESCE(SUM(d.headshots), 0)::int AS total_headshots,
      COALESCE(SUM(d.bodyshots), 0)::int AS total_bodyshots,
      COALESCE(SUM(d.legshots), 0)::int AS total_legshots
    FROM ${valorantTables.mapRoundPlayerLoadoutsRaw} ps
    JOIN ${valorantTables.mapRoundsRaw} r ON r.id = ps.map_round_id
    JOIN ${valorantTables.maps} gm ON gm.id = r.map_id
    JOIN ${valorantTables.matches} m ON m.id = gm.match_id
    JOIN ${valorantTables.stageContainers} sc ON sc.id = m.container_id
    JOIN ${valorantTables.stages} st ON st.id = sc.stage_id
    JOIN ${valorantTables.mapPlayerStats} mps ON mps.map_id = r.map_id AND mps.person_id = ps.person_id
    LEFT JOIN LATERAL (
      SELECT SUM(dm.damage) AS damage, SUM(dm.headshots) AS headshots, SUM(dm.bodyshots) AS bodyshots, SUM(dm.legshots) AS legshots
      FROM ${valorantTables.mapRoundDamagesRaw} dm
      WHERE dm.map_round_id = ps.map_round_id AND dm.attacker_person_id = ps.person_id
    ) d ON true
    WHERE ${sideEntrantCol} = ps.entrant_id AND ${roundScopeSql(scope)} ${rawFilterSql(filter)}
  `);

  const row = result.rows[0];
  if (!row) return ZERO_SIDE(side);

  const roundsPlayed = Number(row.rounds_played);
  const roundsWon = Number(row.rounds_won);
  const totalHeadshots = Number(row.total_headshots);
  const totalBodyshots = Number(row.total_bodyshots);
  const totalLegshots = Number(row.total_legshots);
  const totalShots = totalHeadshots + totalBodyshots + totalLegshots;

  const { firstKills, firstDeaths } = await fetchFirstBloodCounts(scope, filter, side);

  return {
    side,
    rounds_played: roundsPlayed,
    rounds_won: roundsWon,
    round_winrate: roundsPlayed > 0 ? roundsWon / roundsPlayed : 0,
    total_kills: Number(row.total_kills),
    avg_kills_per_round: Number(row.avg_kills_per_round),
    total_assists: Number(row.total_assists),
    avg_assists_per_round: Number(row.avg_assists_per_round),
    total_score: Number(row.total_score),
    avg_acs_per_round: Number(row.avg_acs_per_round),
    total_damage: Number(row.total_damage),
    avg_adr_per_round: Number(row.avg_adr_per_round),
    total_headshots: totalHeadshots,
    total_bodyshots: totalBodyshots,
    total_legshots: totalLegshots,
    headshot_percentage: totalShots > 0 ? totalHeadshots / totalShots : 0,
    first_kills: firstKills,
    first_deaths: firstDeaths,
  };
}

/** Counts rounds where the round's earliest kill (`time_ms` ascending) was landed / suffered by this scope, restricted to `side`. */
async function fetchFirstBloodCounts(scope: EntityScope, filter: StatsFilter, side: "atk" | "def"): Promise<{ firstKills: number; firstDeaths: number }> {
  const sideEntrantCol = side === "atk" ? sql`r.atk_entrant_id` : sql`r.def_entrant_id`;

  // The first kill is looked up per in-scope round only, instead of ranking every kill in the table.
  const result = await db.execute<{ first_kills: number; first_deaths: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE fk.killer_person_id = ps.person_id)::int AS first_kills,
      COUNT(*) FILTER (WHERE fk.victim_person_id = ps.person_id)::int AS first_deaths
    FROM ${valorantTables.mapRoundPlayerLoadoutsRaw} ps
    JOIN ${valorantTables.mapRoundsRaw} r ON r.id = ps.map_round_id
    JOIN ${valorantTables.maps} gm ON gm.id = r.map_id
    JOIN ${valorantTables.matches} m ON m.id = gm.match_id
    JOIN ${valorantTables.stageContainers} sc ON sc.id = m.container_id
    JOIN ${valorantTables.stages} st ON st.id = sc.stage_id
    JOIN ${valorantTables.mapPlayerStats} mps ON mps.map_id = r.map_id AND mps.person_id = ps.person_id
    JOIN LATERAL (
      SELECT k.killer_person_id, k.victim_person_id
      FROM ${valorantTables.mapRoundKillsRaw} k
      WHERE k.map_round_id = r.id
      ORDER BY k.time_ms ASC
      LIMIT 1
    ) fk ON (fk.killer_person_id = ps.person_id OR fk.victim_person_id = ps.person_id)
    WHERE ${sideEntrantCol} = ps.entrant_id AND ${roundScopeSql(scope)} ${rawFilterSql(filter)}
  `);

  const row = result.rows[0];
  return { firstKills: Number(row?.first_kills ?? 0), firstDeaths: Number(row?.first_deaths ?? 0) };
}

/**
 * Average stats always split by side (atk/def) — shared by `/teams/{id}/stats`
 * and `/players/{id}/stats`. `maps_played` is the count of DISTINCT maps, not
 * of `map_player_stats` rows: for a team scope that's 5 rows per map (one per
 * player), which the Rust API summed/averaged over directly — a latent bug
 * there this port doesn't reproduce.
 */
export async function fetchAvgStats(game: GameSlug, scope: EntityScope, filter: StatsFilter): Promise<ApiAvgStats> {
  const { matches, stageContainers, stages } = gameTables(game);
  const { mapPlayerStats, maps } = valorantTablesOf(game);
  if (isEmptyTeamScope(scope)) return ZERO_AVG_STATS;

  const sidesPromise = Promise.all([fetchSideStats(scope, filter, "atk"), fetchSideStats(scope, filter, "def")]);

  const where = and(mapPlayerStatsScopeCondition(scope), ...baseFilterConditions(game, filter));

  const totalsQuery = db
    .select({
      mapsPlayed: sql<number>`count(distinct ${mapPlayerStats.mapId})::int`,
      kills: sumFloat(mapPlayerStats.kills),
      deaths: sumFloat(mapPlayerStats.deaths),
      assists: sumFloat(mapPlayerStats.assists),
      acs: sumFloat(mapPlayerStats.acs),
      adr: sumFloat(mapPlayerStats.adr),
      kast: sumFloat(mapPlayerStats.kastPercentage),
      hs: sumFloat(mapPlayerStats.headshotPercentage),
      firstKills: sumFloat(mapPlayerStats.firstKills),
      firstDeaths: sumFloat(mapPlayerStats.firstDeaths),
      rating: weightedRatingSql,
      ratedRounds: ratedRoundsSql,
    })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(where);

  // A team scope has one row per player per map, so each (map, entrant) is counted once.
  const perMapEntrant = db
    .selectDistinctOn([mapPlayerStats.mapId, mapPlayerStats.entrantId], { rounds: sql<number>`${playerRoundsPlayedSql()}`.as("rounds") })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(where)
    .as("per_map_entrant");
  const roundsQuery = db.select({ total: sql<number>`coalesce(sum(${perMapEntrant.rounds}), 0)::int` }).from(perMapEntrant);

  const [[totals], [roundsRow], [atk, def]] = await Promise.all([totalsQuery, roundsQuery, sidesPromise]);

  const mapsPlayed = Number(totals?.mapsPlayed ?? 0);
  if (!totals || mapsPlayed === 0) return { ...ZERO_AVG_STATS, by_side: { atk, def } };

  const roundsPlayed = Number(roundsRow?.total ?? 0);
  const avg = (total: number) => total / mapsPlayed;

  const avgKills = avg(totals.kills);
  const avgDeaths = avg(totals.deaths);

  return {
    maps_played: mapsPlayed,
    rounds_played: roundsPlayed,
    total_kills: totals.kills,
    avg_kills: avgKills,
    total_deaths: totals.deaths,
    avg_deaths: avgDeaths,
    total_assists: totals.assists,
    avg_assists: avg(totals.assists),
    total_acs: totals.acs,
    avg_acs: avg(totals.acs),
    total_adr: totals.adr,
    avg_adr: avg(totals.adr),
    total_kast_percentage: totals.kast,
    avg_kast_percentage: avg(totals.kast),
    total_headshot_percentage: totals.hs,
    avg_headshot_percentage: avg(totals.hs),
    total_first_kills: totals.firstKills,
    avg_first_kills: avg(totals.firstKills),
    total_first_deaths: totals.firstDeaths,
    avg_first_deaths: avg(totals.firstDeaths),
    kd_ratio: avgDeaths > 0 ? avgKills / avgDeaths : avgKills,
    avg_rating: roundRating(totals.rating),
    rating_rounds: Number(totals.ratedRounds) > 0 ? Number(totals.ratedRounds) : null,
    by_side: { atk, def },
  };
}

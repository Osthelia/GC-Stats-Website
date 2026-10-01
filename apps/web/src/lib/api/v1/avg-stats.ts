/**
 * GC-Stats - avg-stats
 *
 * Computes average per-map stats split by side (atk/def) for a team or
 * player scope, shared by the /teams/{id}/stats and /players/{id}/stats
 * v1 endpoints.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { mapPlayerStats, maps, matches, stageContainers, stages } from "@gc-stats/db";
import { exclusiveUpperBound, type StatsFilter } from "./params";

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
  by_side: { atk: ApiSideStats; def: ApiSideStats };
};

function isEmptyTeamScope(scope: EntityScope): boolean {
  return scope.kind === "team" && scope.entrantIds.length === 0;
}

function mapPlayerStatsScopeCondition(scope: EntityScope): SQL {
  return scope.kind === "team" ? inArray(mapPlayerStats.entrantId, scope.entrantIds) : eq(mapPlayerStats.personId, scope.personId);
}

function baseFilterConditions(filter: StatsFilter): SQL[] {
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
  by_side: { atk: ZERO_SIDE("atk"), def: ZERO_SIDE("def") },
};

function roundScopeSql(scope: EntityScope): SQL {
  return scope.kind === "team" ? sql`ps.entrant_id = ANY(${scope.entrantIds}::bigint[])` : sql`ps.person_id = ${scope.personId}`;
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
    FROM map_round_player_loadouts_raw ps
    JOIN map_rounds_raw r ON r.id = ps.map_round_id
    JOIN maps gm ON gm.id = r.map_id
    JOIN matches m ON m.id = gm.match_id
    JOIN stage_containers sc ON sc.id = m.container_id
    JOIN stages st ON st.id = sc.stage_id
    JOIN map_player_stats mps ON mps.map_id = r.map_id AND mps.person_id = ps.person_id
    LEFT JOIN (
      SELECT map_round_id, attacker_person_id,
        SUM(damage) AS damage, SUM(headshots) AS headshots, SUM(bodyshots) AS bodyshots, SUM(legshots) AS legshots
      FROM map_round_damages_raw
      GROUP BY map_round_id, attacker_person_id
    ) d ON d.map_round_id = ps.map_round_id AND d.attacker_person_id = ps.person_id
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

  const firstKills = await fetchFirstBloodCount(scope, filter, side, "killer_person_id");
  const firstDeaths = await fetchFirstBloodCount(scope, filter, side, "victim_person_id");

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

/** Counts rounds where the round's earliest kill (`time_ms` ascending) was landed by / suffered by this scope, restricted to `side`. */
async function fetchFirstBloodCount(
  scope: EntityScope,
  filter: StatsFilter,
  side: "atk" | "def",
  anchorColumn: "killer_person_id" | "victim_person_id",
): Promise<number> {
  const sideEntrantCol = side === "atk" ? sql`r.atk_entrant_id` : sql`r.def_entrant_id`;
  const anchor = anchorColumn === "killer_person_id" ? sql`fk.killer_person_id` : sql`fk.victim_person_id`;

  const result = await db.execute<{ first_count: number }>(sql`
    SELECT COUNT(*)::int AS first_count
    FROM (
      SELECT k.map_round_id, k.killer_person_id, k.victim_person_id,
        ROW_NUMBER() OVER (PARTITION BY k.map_round_id ORDER BY k.time_ms ASC) AS rn
      FROM map_round_kills_raw k
    ) fk
    JOIN map_rounds_raw r ON r.id = fk.map_round_id
    JOIN map_round_player_loadouts_raw ps ON ps.map_round_id = fk.map_round_id AND ps.person_id = ${anchor}
    JOIN maps gm ON gm.id = r.map_id
    JOIN matches m ON m.id = gm.match_id
    JOIN stage_containers sc ON sc.id = m.container_id
    JOIN stages st ON st.id = sc.stage_id
    JOIN map_player_stats mps ON mps.map_id = r.map_id AND mps.person_id = ps.person_id
    WHERE fk.rn = 1 AND ${sideEntrantCol} = ps.entrant_id AND ${roundScopeSql(scope)} ${rawFilterSql(filter)}
  `);

  return Number(result.rows[0]?.first_count ?? 0);
}

type BaseStatsRow = {
  mapId: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kastPercentage: string;
  headshotPercentage: string;
  firstKills: number;
  firstDeaths: number;
};

/**
 * Average stats always split by side (atk/def) — shared by `/teams/{id}/stats`
 * and `/players/{id}/stats`. `maps_played` is the count of DISTINCT maps, not
 * of `map_player_stats` rows: for a team scope that's 5 rows per map (one per
 * player), which the Rust API summed/averaged over directly — a latent bug
 * there this port doesn't reproduce.
 */
export async function fetchAvgStats(scope: EntityScope, filter: StatsFilter): Promise<ApiAvgStats> {
  if (isEmptyTeamScope(scope)) return ZERO_AVG_STATS;

  const rows: BaseStatsRow[] = await db
    .select({
      mapId: mapPlayerStats.mapId,
      kills: mapPlayerStats.kills,
      deaths: mapPlayerStats.deaths,
      assists: mapPlayerStats.assists,
      acs: mapPlayerStats.acs,
      adr: mapPlayerStats.adr,
      kastPercentage: mapPlayerStats.kastPercentage,
      headshotPercentage: mapPlayerStats.headshotPercentage,
      firstKills: mapPlayerStats.firstKills,
      firstDeaths: mapPlayerStats.firstDeaths,
    })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(mapPlayerStatsScopeCondition(scope), ...baseFilterConditions(filter)));

  const [atk, def] = await Promise.all([fetchSideStats(scope, filter, "atk"), fetchSideStats(scope, filter, "def")]);

  if (rows.length === 0) return { ...ZERO_AVG_STATS, by_side: { atk, def } };

  const mapsPlayed = new Set(rows.map((r) => r.mapId)).size;
  const sum = (f: (r: BaseStatsRow) => number) => rows.reduce((acc, r) => acc + f(r), 0);
  const avg = (total: number) => (mapsPlayed > 0 ? total / mapsPlayed : 0);

  const totalKills = sum((r) => r.kills);
  const totalDeaths = sum((r) => r.deaths);
  const avgKills = avg(totalKills);
  const avgDeaths = avg(totalDeaths);
  const totalKast = sum((r) => Number(r.kastPercentage));
  const totalHs = sum((r) => Number(r.headshotPercentage));

  return {
    maps_played: mapsPlayed,
    total_kills: totalKills,
    avg_kills: avgKills,
    total_deaths: totalDeaths,
    avg_deaths: avgDeaths,
    total_assists: sum((r) => r.assists),
    avg_assists: avg(sum((r) => r.assists)),
    total_acs: sum((r) => r.acs),
    avg_acs: avg(sum((r) => r.acs)),
    total_adr: sum((r) => r.adr),
    avg_adr: avg(sum((r) => r.adr)),
    total_kast_percentage: totalKast,
    avg_kast_percentage: avg(totalKast),
    total_headshot_percentage: totalHs,
    avg_headshot_percentage: avg(totalHs),
    total_first_kills: sum((r) => r.firstKills),
    avg_first_kills: avg(sum((r) => r.firstKills)),
    total_first_deaths: sum((r) => r.firstDeaths),
    avg_first_deaths: avg(sum((r) => r.firstDeaths)),
    kd_ratio: avgDeaths > 0 ? avgKills / avgDeaths : avgKills,
    by_side: { atk, def },
  };
}

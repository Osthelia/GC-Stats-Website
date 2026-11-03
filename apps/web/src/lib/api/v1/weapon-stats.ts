/**
 * GC-Stats - weapon-stats
 *
 * Weapon usage stats (kills, times played) for a player or team, shared by
 * the `/teams/{id}/weapons` and `/players/{id}/weapons` v1 endpoints.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { mapPlayerStats, maps, matches, stageContainers, stages } from "@gc-stats/db";
import { exclusiveUpperBound, type MapsFilter } from "./params";
import { jsonObject } from "@/lib/stats-aggregate-sql";
import type { EntityScope } from "./avg-stats";

export type ApiWeaponStatsEntry = { weapon: string; times_played: number | null; kills: number };

function scopeCondition(scope: EntityScope) {
  return scope.kind === "team" ? inArray(mapPlayerStats.entrantId, scope.entrantIds) : eq(mapPlayerStats.personId, scope.personId);
}

function roundScopeSql(scope: EntityScope) {
  return scope.kind === "team" ? sql`ps.entrant_id = ANY(${sql.param(scope.entrantIds)}::bigint[])` : sql`ps.person_id = ${scope.personId}`;
}

function isEmptyTeamScope(scope: EntityScope): boolean {
  return scope.kind === "team" && scope.entrantIds.length === 0;
}

/**
 * Weapon usage for a player or team: kills come from `map_player_stats.weapon_kills`
 * (pre-aggregated) — unlike V1 this no longer mixes in ability kills (V2 tracks
 * those separately in `ability_kills`), a correction, not a bug. `times_played`
 * (rounds the weapon was held) still needs the RAW round layer, same as V1.
 * Shared by `/teams/{id}/weapons` and `/players/{id}/weapons`.
 */
export async function fetchWeaponStats(scope: EntityScope, filter: MapsFilter): Promise<ApiWeaponStatsEntry[]> {
  if (isEmptyTeamScope(scope)) return [];

  const needsStage = !!filter.tournamentId;
  const needsMatch = needsStage || !!filter.from || !!filter.to;

  const dateConds = [];
  if (filter.from) dateConds.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) dateConds.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  if (filter.tournamentId) dateConds.push(eq(stages.tournamentId, filter.tournamentId));

  // Joins are only added when a filter needs them, and weapon kills are summed in Postgres.
  const killsQuery = db.execute<{ weapon: string; kills: number }>(sql`
    SELECT w.key AS weapon, SUM(w.value::numeric)::float8 AS kills
    FROM ${mapPlayerStats}
    ${needsMatch ? sql`JOIN ${maps} ON ${maps.id} = ${mapPlayerStats.mapId} JOIN ${matches} ON ${matches.id} = ${maps.matchId}` : sql``}
    ${needsStage ? sql`JOIN ${stageContainers} ON ${stageContainers.id} = ${matches.containerId} JOIN ${stages} ON ${stages.id} = ${stageContainers.stageId}` : sql``}
    CROSS JOIN LATERAL jsonb_each_text(${jsonObject(mapPlayerStats.weaponKills)}) AS w
    WHERE ${and(scopeCondition(scope), ...dateConds)}
    GROUP BY w.key
  `);

  const playedQuery = db.execute<{ weapon: string; times_played: number }>(sql`
    SELECT ps.weapon AS weapon, COUNT(*)::int AS times_played
    FROM map_round_player_loadouts_raw ps
    ${needsMatch ? sql`JOIN map_rounds_raw r ON r.id = ps.map_round_id JOIN maps gm ON gm.id = r.map_id JOIN matches m ON m.id = gm.match_id` : sql``}
    ${needsStage ? sql`JOIN stage_containers sc ON sc.id = m.container_id JOIN stages st ON st.id = sc.stage_id` : sql``}
    WHERE ps.weapon IS NOT NULL AND ${roundScopeSql(scope)}
      ${filter.from ? sql`AND m.scheduled_at >= ${new Date(`${filter.from}T00:00:00.000Z`)}` : sql``}
      ${filter.to ? sql`AND m.scheduled_at < ${exclusiveUpperBound(filter.to)}` : sql``}
      ${filter.tournamentId ? sql`AND st.tournament_id = ${filter.tournamentId}` : sql``}
    GROUP BY ps.weapon
  `);

  const [killsResult, playedResult] = await Promise.all([killsQuery, playedQuery]);

  const killsByWeapon = new Map<string, number>(killsResult.rows.map((r): [string, number] => [r.weapon, Number(r.kills)]));
  const timesPlayedByWeapon = new Map<string, number>(playedResult.rows.map((r): [string, number] => [r.weapon, Number(r.times_played)]));
  const weapons = new Set([...killsByWeapon.keys(), ...timesPlayedByWeapon.keys()]);

  return [...weapons]
    .map((weapon) => ({ weapon, times_played: timesPlayedByWeapon.get(weapon) ?? null, kills: killsByWeapon.get(weapon) ?? 0 }))
    .sort((a, b) => b.kills - a.kills);
}

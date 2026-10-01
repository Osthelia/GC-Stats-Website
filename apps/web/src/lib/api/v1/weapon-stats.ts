/**
 * GC-Stats - weapon-stats
 *
 * Weapon usage stats (kills, times played) for a player or team, shared by
 * the `/teams/{id}/weapons` and `/players/{id}/weapons` v1 endpoints.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { mapPlayerStats, maps, matches, stageContainers, stages } from "@gc-stats/db";
import { exclusiveUpperBound, type MapsFilter } from "./params";
import type { EntityScope } from "./avg-stats";

export type ApiWeaponStatsEntry = { weapon: string; times_played: number | null; kills: number };

function scopeCondition(scope: EntityScope) {
  return scope.kind === "team" ? inArray(mapPlayerStats.entrantId, scope.entrantIds) : eq(mapPlayerStats.personId, scope.personId);
}

function roundScopeSql(scope: EntityScope) {
  return scope.kind === "team" ? sql`ps.entrant_id = ANY(${scope.entrantIds}::bigint[])` : sql`ps.person_id = ${scope.personId}`;
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

  const dateConds = [];
  if (filter.from) dateConds.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) dateConds.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  if (filter.tournamentId) dateConds.push(eq(stages.tournamentId, filter.tournamentId));

  const statsRows = await db
    .select({ weaponKills: mapPlayerStats.weaponKills })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(scopeCondition(scope), ...dateConds));

  const killsByWeapon = new Map<string, number>();
  for (const row of statsRows) {
    const weaponKills = (row.weaponKills as Record<string, number>) ?? {};
    for (const [weapon, kills] of Object.entries(weaponKills)) {
      killsByWeapon.set(weapon, (killsByWeapon.get(weapon) ?? 0) + Number(kills));
    }
  }

  const playedResult = await db.execute<{ weapon: string; times_played: number }>(sql`
    SELECT ps.weapon AS weapon, COUNT(*)::int AS times_played
    FROM map_round_player_loadouts_raw ps
    JOIN map_rounds_raw r ON r.id = ps.map_round_id
    JOIN maps gm ON gm.id = r.map_id
    JOIN matches m ON m.id = gm.match_id
    JOIN stage_containers sc ON sc.id = m.container_id
    JOIN stages st ON st.id = sc.stage_id
    WHERE ps.weapon IS NOT NULL AND ${roundScopeSql(scope)}
      ${filter.from ? sql`AND m.scheduled_at >= ${new Date(`${filter.from}T00:00:00.000Z`)}` : sql``}
      ${filter.to ? sql`AND m.scheduled_at < ${exclusiveUpperBound(filter.to)}` : sql``}
      ${filter.tournamentId ? sql`AND st.tournament_id = ${filter.tournamentId}` : sql``}
    GROUP BY ps.weapon
  `);

  const timesPlayedByWeapon = new Map<string, number>(
    playedResult.rows.map((r: { weapon: string; times_played: number }): [string, number] => [r.weapon, Number(r.times_played)]),
  );
  const weapons = new Set([...killsByWeapon.keys(), ...timesPlayedByWeapon.keys()]);

  return [...weapons]
    .map((weapon) => ({ weapon, times_played: timesPlayedByWeapon.get(weapon) ?? null, kills: killsByWeapon.get(weapon) ?? 0 }))
    .sort((a, b) => b.kills - a.kills);
}

/**
 * GC-Stats — 09-game-maps-rounds
 *
 * V1 to V2 migration step: migrates maps and their raw round level data
 * (kills, damages, alive states, player positions, loadouts).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { v1 } from "./connection";
import { getMappedId, tryMappedId, preloadEntityType, batchInsert } from "./id-map";
import { entrantKey } from "./05-entrants-matches";
import {
  maps, mapRoundsRaw, mapRoundKillsRaw, mapRoundDamagesRaw,
  mapRoundAliveStatesRaw, mapRoundPlayerPositionsRaw, mapRoundPlayerLoadoutsRaw,
} from "../../src/schema";

function parseJsonArray(val: unknown): number[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val;
  try { const parsed = JSON.parse(val as string); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function migrateMaps() {
  await preloadEntityType("match");
  const [rows] = await v1.query<any[]>(
    `SELECT id, match_id, api_match_id, map_name, team_a_score, team_b_score, \`order\`,
            is_completed, started_at, note
     FROM game_maps`
  );
  const { created, skipped, invalid } = await batchInsert(
    "map",
    rows as any[],
    (row) => row.id,
    (row) => {
      const matchId = tryMappedId("match", row.match_id);
      if (!matchId) return null;
      return {
        matchId,
        apiMatchId: row.api_match_id,
        mapName: row.map_name,
        teamAScore: row.team_a_score,
        teamBScore: row.team_b_score,
        order: row.order,
        isCompleted: !!row.is_completed,
        startedAt: row.started_at,
        note: row.note,
      };
    },
    (tx, values) => tx.insert(maps).values(values as any).returning({ id: maps.id }),
    1000,
  );
  console.log(`maps: ${created} created, ${skipped} already migrated, ${invalid} unresolved match`);
}

export async function migrateMapRounds() {
  await preloadEntityType("map");
  await preloadEntityType("entrant");
  const [rows] = await v1.query<any[]>(
    `SELECT id, tournament_id, game_map_id, round_number, winning_team, win_type,
            atk_team, def_team, plant_site, plant_x, plant_y, plant_time_ms
     FROM game_map_rounds`
  );
  const resolveEntrant = (tournamentId: number, teamId: number | null) =>
    teamId == null ? null : tryMappedId("entrant", entrantKey(tournamentId, teamId)) ?? null;

  const { created, skipped, invalid } = await batchInsert(
    "map_round",
    rows as any[],
    (row) => row.id,
    (row) => {
      const mapId = tryMappedId("map", row.game_map_id);
      if (!mapId) return null;
      return {
        mapId,
        roundNumber: row.round_number,
        winningEntrantId: resolveEntrant(row.tournament_id, row.winning_team),
        winType: row.win_type,
        atkEntrantId: resolveEntrant(row.tournament_id, row.atk_team),
        defEntrantId: resolveEntrant(row.tournament_id, row.def_team),
        plantSite: row.plant_site,
        plantX: row.plant_x,
        plantY: row.plant_y,
        plantTimeMs: row.plant_time_ms,
      };
    },
    (tx, values) => tx.insert(mapRoundsRaw).values(values as any).returning({ id: mapRoundsRaw.id }),
    1000,
  );
  console.log(`map_rounds_raw: ${created} created, ${skipped} already migrated, ${invalid} unresolved map`);
}

export async function migrateMapRoundKills() {
  await preloadEntityType("map_round");
  await preloadEntityType("player");
  const [rows] = await v1.query<any[]>(
    `SELECT id, game_map_round_id, killer_player_id, victim_player_id, time_ms,
            weapon, damage_type, is_secondary_fire, assistant_player_ids
     FROM game_map_round_kills`
  );
  const { created, skipped, invalid } = await batchInsert(
    "map_round_kill",
    rows as any[],
    (row) => row.id,
    (row) => {
      const mapRoundId = tryMappedId("map_round", row.game_map_round_id);
      const victimPersonId = tryMappedId("player", row.victim_player_id);
      if (!mapRoundId || !victimPersonId) return null;
      const assistantPersonIds = parseJsonArray(row.assistant_player_ids)
        .map((legacyId) => tryMappedId("player", legacyId))
        .filter((id): id is number => id != null);
      return {
        mapRoundId,
        killerPersonId: row.killer_player_id ? tryMappedId("player", row.killer_player_id) ?? null : null,
        victimPersonId,
        timeMs: row.time_ms,
        weapon: row.weapon,
        damageType: row.damage_type,
        isSecondaryFire: !!row.is_secondary_fire,
        assistantPersonIds: assistantPersonIds.length > 0 ? assistantPersonIds : null,
      };
    },
    (tx, values) => tx.insert(mapRoundKillsRaw).values(values as any).returning({ id: mapRoundKillsRaw.id }),
    2000,
  );
  console.log(`map_round_kills_raw: ${created} created, ${skipped} already migrated, ${invalid} unresolved`);
}

export async function migrateMapRoundDamages() {
  await preloadEntityType("map_round");
  await preloadEntityType("player");
  const [rows] = await v1.query<any[]>(
    `SELECT id, game_map_round_id, attacker_player_id, receiver_player_id,
            damage, headshots, bodyshots, legshots
     FROM game_map_round_damages`
  );
  const { created, skipped, invalid } = await batchInsert(
    "map_round_damage",
    rows as any[],
    (row) => row.id,
    (row) => {
      const mapRoundId = tryMappedId("map_round", row.game_map_round_id);
      const receiverPersonId = tryMappedId("player", row.receiver_player_id);
      if (!mapRoundId || !receiverPersonId) return null;
      return {
        mapRoundId,
        attackerPersonId: row.attacker_player_id ? tryMappedId("player", row.attacker_player_id) ?? null : null,
        receiverPersonId,
        damage: row.damage,
        headshots: row.headshots,
        bodyshots: row.bodyshots,
        legshots: row.legshots,
      };
    },
    (tx, values) => tx.insert(mapRoundDamagesRaw).values(values as any).returning({ id: mapRoundDamagesRaw.id }),
    2000,
  );
  console.log(`map_round_damages_raw: ${created} created, ${skipped} already migrated, ${invalid} unresolved`);
}

export async function migrateMapRoundAliveStates() {
  await preloadEntityType("map_round");
  const [rows] = await v1.query<any[]>(
    `SELECT id, game_map_round_id, sequence, time_ms, atk_alive, def_alive, winner_side
     FROM game_map_round_alive_states`
  );
  const { created, skipped, invalid } = await batchInsert(
    "map_round_alive_state",
    rows as any[],
    (row) => row.id,
    (row) => {
      const mapRoundId = tryMappedId("map_round", row.game_map_round_id);
      if (!mapRoundId) return null;
      return {
        mapRoundId,
        sequence: row.sequence,
        timeMs: row.time_ms,
        atkAlive: row.atk_alive,
        defAlive: row.def_alive,
        winnerSide: row.winner_side,
      };
    },
    (tx, values) => tx.insert(mapRoundAliveStatesRaw).values(values as any).returning({ id: mapRoundAliveStatesRaw.id }),
    2000,
  );
  console.log(`map_round_alive_states_raw: ${created} created, ${skipped} already migrated, ${invalid} unresolved`);
}

export async function migrateMapRoundPlayerPositions() {
  await preloadEntityType("map_round");
  await preloadEntityType("map");
  await preloadEntityType("player");
  await preloadEntityType("map_round_kill");
  const [rows] = await v1.query<any[]>(
    `SELECT id, game_map_round_id, game_map_id, event_type, game_map_round_kill_id,
            player_id, role, x, y, view_radians, time_ms
     FROM game_map_round_player_positions`
  );
  const { created, skipped, invalid } = await batchInsert(
    "map_round_position",
    rows as any[],
    (row) => row.id,
    (row) => {
      const mapRoundId = tryMappedId("map_round", row.game_map_round_id);
      const mapId = row.game_map_id ? tryMappedId("map", row.game_map_id) : undefined;
      const personId = tryMappedId("player", row.player_id);
      if (!mapRoundId || !mapId || !personId) return null;
      return {
        mapRoundId,
        mapId,
        eventType: row.event_type,
        mapRoundKillId: row.game_map_round_kill_id ? tryMappedId("map_round_kill", row.game_map_round_kill_id) ?? null : null,
        personId,
        role: row.role,
        x: row.x,
        y: row.y,
        viewRadians: row.view_radians,
        timeMs: row.time_ms,
      };
    },
    (tx, values) => tx.insert(mapRoundPlayerPositionsRaw).values(values as any).returning({ id: mapRoundPlayerPositionsRaw.id }),
    2000,
  );
  console.log(`map_round_player_positions_raw: ${created} created, ${skipped} already migrated, ${invalid} unresolved`);
}

export async function migrateMapRoundPlayerLoadouts() {
  await preloadEntityType("map_round");
  await preloadEntityType("player");
  await preloadEntityType("entrant");
  const [rows] = await v1.query<any[]>(
    `SELECT id, tournament_id, game_map_round_id, player_id, team_id,
            kills, assists, score, loadout_value, economy_spent, economy_remaining, weapon_id, armor
     FROM game_map_round_player_stats`
  );
  const { created, skipped, invalid } = await batchInsert(
    "map_round_loadout",
    rows as any[],
    (row) => row.id,
    (row) => {
      const mapRoundId = tryMappedId("map_round", row.game_map_round_id);
      const personId = tryMappedId("player", row.player_id);
      if (!mapRoundId || !personId) return null;
      return {
        mapRoundId,
        personId,
        entrantId: row.team_id ? tryMappedId("entrant", entrantKey(row.tournament_id, row.team_id)) ?? null : null,
        kills: row.kills,
        assists: row.assists,
        score: row.score,
        loadoutValue: row.loadout_value,
        economySpent: row.economy_spent,
        economyRemaining: row.economy_remaining,
        weapon: row.weapon_id,
        armor: row.armor,
      };
    },
    (tx, values) => tx.insert(mapRoundPlayerLoadoutsRaw).values(values as any).returning({ id: mapRoundPlayerLoadoutsRaw.id }),
    2000,
  );
  console.log(`map_round_player_loadouts_raw: ${created} created, ${skipped} already migrated, ${invalid} unresolved`);
}

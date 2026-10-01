/**
 * GC-Stats - matches
 *
 * Query helpers for the API v1 `/matches/{id}` endpoint: fetches a match with
 * its entrants, teams, maps and round level stats, joined and shaped for the
 * public response.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import {
  matches,
  entrants,
  teams,
  stageContainers,
  stages,
  maps,
  matchVetos,
  mapPlayerStats,
  mapRoundsRaw,
  mapRoundPlayerLoadoutsRaw,
  mapRoundDamagesRaw,
  mapRoundKillsRaw,
} from "@gc-stats/db";
import { toApiTeamFromJoined, type ApiTeam } from "../entities";
import { resolveEntrantTeamIds } from "../entrant-teams";

const entrantAAlias = alias(entrants, "match_full_entrant_a");
const entrantBAlias = alias(entrants, "match_full_entrant_b");
const teamAAlias = alias(teams, "match_full_team_a");
const teamBAlias = alias(teams, "match_full_team_b");

export type ApiMatchVeto = { match_id: number; team_id: number; map_name: string; type: string; order: number };
export type ApiTeamWithScore = { team: ApiTeam; score: number | null };

export type ApiGameMap = {
  id: number;
  match_id: number;
  api_match_id: string | null;
  map_name: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  order: number;
  is_completed: boolean;
};

type MapRow = {
  id: number;
  matchId: number;
  apiMatchId: string | null;
  mapName: string | null;
  teamAScore: number | null;
  teamBScore: number | null;
  order: number;
  isCompleted: boolean;
};

export function toApiGameMap(row: MapRow): ApiGameMap {
  return {
    id: row.id,
    match_id: row.matchId,
    api_match_id: row.apiMatchId,
    map_name: row.mapName,
    team_a_score: row.teamAScore,
    team_b_score: row.teamBScore,
    order: row.order,
    is_completed: row.isCompleted,
  };
}

const MAP_COLUMNS = {
  id: maps.id,
  matchId: maps.matchId,
  apiMatchId: maps.apiMatchId,
  mapName: maps.mapName,
  teamAScore: maps.teamAScore,
  teamBScore: maps.teamBScore,
  order: maps.order,
  isCompleted: maps.isCompleted,
};

export type ApiMatchCore = {
  id: number;
  tournament_id: number | null;
  phase_id: number | null;
  round_number: number | null;
  round_name: string | null;
  scheduled_at: string | null;
  status: string;
  best_of: number;
  patch: string | null;
  team_a: ApiTeamWithScore | null;
  team_b: ApiTeamWithScore | null;
};

async function getMatchCore(matchId: number): Promise<ApiMatchCore | null> {
  const [row] = await db
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
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!row) return null;

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
  };
}

async function getMatchVetosResolved(matchId: number): Promise<ApiMatchVeto[]> {
  const vetoRows = await db
    .select({ entrantId: matchVetos.entrantId, mapName: matchVetos.mapName, type: matchVetos.type, order: matchVetos.order })
    .from(matchVetos)
    .where(eq(matchVetos.matchId, matchId))
    .orderBy(asc(matchVetos.order));

  const teamByEntrant = await resolveEntrantTeamIds([...new Set(vetoRows.map((v) => v.entrantId))]);

  return vetoRows.map((v) => ({ match_id: matchId, team_id: teamByEntrant.get(v.entrantId) ?? 0, map_name: v.mapName, type: v.type, order: v.order }));
}

export type ApiMatchFullResponse = ApiMatchCore & { maps: ApiGameMap[]; vetos: ApiMatchVeto[] };

export async function getMatchFullResponse(matchId: number): Promise<ApiMatchFullResponse | null> {
  const core = await getMatchCore(matchId);
  if (!core) return null;

  const [mapRows, vetos] = await Promise.all([
    db.select(MAP_COLUMNS).from(maps).where(eq(maps.matchId, matchId)).orderBy(asc(maps.order)),
    getMatchVetosResolved(matchId),
  ]);

  return { ...core, maps: mapRows.map(toApiGameMap), vetos };
}

export type ApiMapPlayerStat = {
  id: number;
  person_id: number | null;
  team_id: number;
  agent_name: string | null;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  first_kills: number;
  first_deaths: number;
  kast_percentage: number;
  headshot_percentage: number;
};

export type ApiRoundKillEvent = { kill_player_id: number | null; victim_player_id: number; time_ms: number };

export type ApiRoundPlayerStatFull = {
  player_id: number;
  kills: number;
  assists: number;
  score: number;
  economy_spent: number | null;
  economy_remaining: number | null;
  weapon_id: string | null;
  armor: string | null;
  damage: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
};

export type ApiRoundStatsFull = {
  round_number: number;
  winning_team: number | null;
  win_type: string | null;
  atk_team: number | null;
  def_team: number | null;
  plant_site: string | null;
  player_stats: ApiRoundPlayerStatFull[];
  kills: ApiRoundKillEvent[];
};

export type ApiMapStatsFull = ApiGameMap & { player_stats: ApiMapPlayerStat[]; rounds: ApiRoundStatsFull[] };

export type ApiMatchStatsResponse = ApiMatchCore & { vetos: ApiMatchVeto[]; maps: ApiMapStatsFull[] };

/**
 * Full match stats: per-map aggregated player stats (`map_player_stats`,
 * the equivalent of V1's `game_player_stats`) plus a full round-by-round
 * breakdown, which has no aggregated equivalent and is read directly from
 * the RAW layer (same reasoning as `/teams/{id}/stats`'s XvY/post-plant
 * situations and `/teams/{id}/weapons`'s times_played).
 */
export async function getMatchStatsResponse(matchId: number): Promise<ApiMatchStatsResponse | null> {
  const core = await getMatchCore(matchId);
  if (!core) return null;

  const [mapRows, vetos] = await Promise.all([
    db.select(MAP_COLUMNS).from(maps).where(eq(maps.matchId, matchId)).orderBy(asc(maps.order)),
    getMatchVetosResolved(matchId),
  ]);

  const mapIds = mapRows.map((m) => m.id);
  if (mapIds.length === 0) return { ...core, vetos, maps: [] };

  const [playerStatRows, roundRows] = await Promise.all([
    db
      .select({
        id: mapPlayerStats.id,
        mapId: mapPlayerStats.mapId,
        personId: mapPlayerStats.personId,
        entrantId: mapPlayerStats.entrantId,
        agentName: mapPlayerStats.agentName,
        kills: mapPlayerStats.kills,
        deaths: mapPlayerStats.deaths,
        assists: mapPlayerStats.assists,
        acs: mapPlayerStats.acs,
        adr: mapPlayerStats.adr,
        firstKills: mapPlayerStats.firstKills,
        firstDeaths: mapPlayerStats.firstDeaths,
        kastPercentage: mapPlayerStats.kastPercentage,
        headshotPercentage: mapPlayerStats.headshotPercentage,
      })
      .from(mapPlayerStats)
      .where(inArray(mapPlayerStats.mapId, mapIds)),
    db
      .select({
        id: mapRoundsRaw.id,
        mapId: mapRoundsRaw.mapId,
        roundNumber: mapRoundsRaw.roundNumber,
        winningEntrantId: mapRoundsRaw.winningEntrantId,
        winType: mapRoundsRaw.winType,
        atkEntrantId: mapRoundsRaw.atkEntrantId,
        defEntrantId: mapRoundsRaw.defEntrantId,
        plantSite: mapRoundsRaw.plantSite,
      })
      .from(mapRoundsRaw)
      .where(inArray(mapRoundsRaw.mapId, mapIds))
      .orderBy(asc(mapRoundsRaw.roundNumber)),
  ]);

  const roundIds = roundRows.map((r) => r.id);

  const entrantIds = [
    ...new Set(
      [...playerStatRows.map((p) => p.entrantId), ...roundRows.flatMap((r) => [r.winningEntrantId, r.atkEntrantId, r.defEntrantId])].filter((id): id is number => id != null),
    ),
  ];
  const teamByEntrant = await resolveEntrantTeamIds(entrantIds);

  const [loadoutRows, damageRows, killRows] =
    roundIds.length > 0
      ? await Promise.all([
          db
            .select({
              mapRoundId: mapRoundPlayerLoadoutsRaw.mapRoundId,
              personId: mapRoundPlayerLoadoutsRaw.personId,
              kills: mapRoundPlayerLoadoutsRaw.kills,
              assists: mapRoundPlayerLoadoutsRaw.assists,
              score: mapRoundPlayerLoadoutsRaw.score,
              economySpent: mapRoundPlayerLoadoutsRaw.economySpent,
              economyRemaining: mapRoundPlayerLoadoutsRaw.economyRemaining,
              weapon: mapRoundPlayerLoadoutsRaw.weapon,
              armor: mapRoundPlayerLoadoutsRaw.armor,
            })
            .from(mapRoundPlayerLoadoutsRaw)
            .where(inArray(mapRoundPlayerLoadoutsRaw.mapRoundId, roundIds)),
          db
            .select({
              mapRoundId: mapRoundDamagesRaw.mapRoundId,
              attackerPersonId: mapRoundDamagesRaw.attackerPersonId,
              damage: sql<number>`sum(${mapRoundDamagesRaw.damage})`,
              headshots: sql<number>`sum(${mapRoundDamagesRaw.headshots})`,
              bodyshots: sql<number>`sum(${mapRoundDamagesRaw.bodyshots})`,
              legshots: sql<number>`sum(${mapRoundDamagesRaw.legshots})`,
            })
            .from(mapRoundDamagesRaw)
            .where(inArray(mapRoundDamagesRaw.mapRoundId, roundIds))
            .groupBy(mapRoundDamagesRaw.mapRoundId, mapRoundDamagesRaw.attackerPersonId),
          db
            .select({ mapRoundId: mapRoundKillsRaw.mapRoundId, killerPersonId: mapRoundKillsRaw.killerPersonId, victimPersonId: mapRoundKillsRaw.victimPersonId, timeMs: mapRoundKillsRaw.timeMs })
            .from(mapRoundKillsRaw)
            .where(inArray(mapRoundKillsRaw.mapRoundId, roundIds))
            .orderBy(asc(mapRoundKillsRaw.timeMs)),
        ])
      : [[], [], []];

  const damageByRoundPlayer = new Map<string, { damage: number; headshots: number; bodyshots: number; legshots: number }>();
  for (const row of damageRows) {
    if (row.attackerPersonId == null) continue;
    damageByRoundPlayer.set(`${row.mapRoundId}:${row.attackerPersonId}`, {
      damage: Number(row.damage),
      headshots: Number(row.headshots),
      bodyshots: Number(row.bodyshots),
      legshots: Number(row.legshots),
    });
  }

  const killsByRound = new Map<number, ApiRoundKillEvent[]>();
  for (const row of killRows) {
    const list = killsByRound.get(row.mapRoundId) ?? [];
    list.push({ kill_player_id: row.killerPersonId, victim_player_id: row.victimPersonId, time_ms: row.timeMs });
    killsByRound.set(row.mapRoundId, list);
  }

  const playerStatsByRound = new Map<number, ApiRoundPlayerStatFull[]>();
  for (const row of loadoutRows) {
    const damage = damageByRoundPlayer.get(`${row.mapRoundId}:${row.personId}`);
    const list = playerStatsByRound.get(row.mapRoundId) ?? [];
    list.push({
      player_id: row.personId,
      kills: row.kills,
      assists: row.assists,
      score: row.score,
      economy_spent: row.economySpent,
      economy_remaining: row.economyRemaining,
      weapon_id: row.weapon,
      armor: row.armor,
      damage: damage?.damage ?? 0,
      headshots: damage?.headshots ?? 0,
      bodyshots: damage?.bodyshots ?? 0,
      legshots: damage?.legshots ?? 0,
    });
    playerStatsByRound.set(row.mapRoundId, list);
  }

  const roundsByMap = new Map<number, ApiRoundStatsFull[]>();
  for (const row of roundRows) {
    const list = roundsByMap.get(row.mapId) ?? [];
    list.push({
      round_number: row.roundNumber,
      winning_team: row.winningEntrantId != null ? (teamByEntrant.get(row.winningEntrantId) ?? null) : null,
      win_type: row.winType,
      atk_team: row.atkEntrantId != null ? (teamByEntrant.get(row.atkEntrantId) ?? null) : null,
      def_team: row.defEntrantId != null ? (teamByEntrant.get(row.defEntrantId) ?? null) : null,
      plant_site: row.plantSite,
      player_stats: playerStatsByRound.get(row.id) ?? [],
      kills: killsByRound.get(row.id) ?? [],
    });
    roundsByMap.set(row.mapId, list);
  }

  const playerStatsByMap = new Map<number, ApiMapPlayerStat[]>();
  for (const row of playerStatRows) {
    const list = playerStatsByMap.get(row.mapId) ?? [];
    list.push({
      id: row.id,
      person_id: row.personId,
      team_id: teamByEntrant.get(row.entrantId) ?? 0,
      agent_name: row.agentName,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      acs: row.acs,
      adr: row.adr,
      first_kills: row.firstKills,
      first_deaths: row.firstDeaths,
      kast_percentage: Number(row.kastPercentage),
      headshot_percentage: Number(row.headshotPercentage),
    });
    playerStatsByMap.set(row.mapId, list);
  }

  const mapsFull: ApiMapStatsFull[] = mapRows.map((row) => ({
    ...toApiGameMap(row),
    player_stats: playerStatsByMap.get(row.id) ?? [],
    rounds: roundsByMap.get(row.id) ?? [],
  }));

  return { ...core, vetos, maps: mapsFull };
}

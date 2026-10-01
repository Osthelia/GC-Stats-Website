/**
 * GC-Stats - map
 *
 * Query helpers for the API v1 `/maps/{id}` endpoint: fetches a single map
 * with its player stats, joined entrants/teams, and round data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { maps, matches, entrants, teams, mapPlayerStats, mapRoundsRaw, mapRoundPlayerLoadoutsRaw } from "@gc-stats/db";
import { toApiTeamFromJoined } from "../entities";
import { resolveEntrantTeamIds } from "../entrant-teams";
import { toApiGameMap, type ApiGameMap, type ApiTeamWithScore, type ApiMapPlayerStat } from "./matches";

const entrantAAlias = alias(entrants, "map_full_entrant_a");
const entrantBAlias = alias(entrants, "map_full_entrant_b");
const teamAAlias = alias(teams, "map_full_team_a");
const teamBAlias = alias(teams, "map_full_team_b");

async function mapExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: maps.id }).from(maps).where(eq(maps.id, id)).limit(1);
  return !!row;
}

async function getMapPlayerStats(mapId: number): Promise<ApiMapPlayerStat[]> {
  const rows = await db
    .select({
      id: mapPlayerStats.id,
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
    .where(eq(mapPlayerStats.mapId, mapId));

  const teamByEntrant = await resolveEntrantTeamIds([...new Set(rows.map((r) => r.entrantId))]);

  return rows.map((row) => ({
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
  }));
}

export type ApiMapFullResponse = ApiGameMap & { player_stats: ApiMapPlayerStat[]; team_a: ApiTeamWithScore | null; team_b: ApiTeamWithScore | null };

export async function getMapFullResponse(mapId: number): Promise<ApiMapFullResponse | null> {
  const [row] = await db
    .select({
      id: maps.id,
      matchId: maps.matchId,
      apiMatchId: maps.apiMatchId,
      mapName: maps.mapName,
      teamAScore: maps.teamAScore,
      teamBScore: maps.teamBScore,
      order: maps.order,
      isCompleted: maps.isCompleted,
      teamA: teamAAlias,
      teamB: teamBAlias,
    })
    .from(maps)
    .leftJoin(matches, eq(matches.id, maps.matchId))
    .leftJoin(entrantAAlias, eq(entrantAAlias.id, matches.entrantAId))
    .leftJoin(teamAAlias, eq(teamAAlias.id, entrantAAlias.teamId))
    .leftJoin(entrantBAlias, eq(entrantBAlias.id, matches.entrantBId))
    .leftJoin(teamBAlias, eq(teamBAlias.id, entrantBAlias.teamId))
    .where(eq(maps.id, mapId))
    .limit(1);

  if (!row) return null;

  const teamA = toApiTeamFromJoined(row.teamA);
  const teamB = toApiTeamFromJoined(row.teamB);
  const playerStats = await getMapPlayerStats(mapId);

  return {
    ...toApiGameMap(row),
    player_stats: playerStats,
    team_a: teamA ? { team: teamA, score: row.teamAScore } : null,
    team_b: teamB ? { team: teamB, score: row.teamBScore } : null,
  };
}

export type ApiRoundPlayerStat = {
  player_id: number;
  kills: number;
  assists: number;
  score: number;
  economy_spent: number | null;
  economy_remaining: number | null;
  weapon_id: string | null;
  armor: string | null;
};

export type ApiRoundFullResponse = { round_number: number; winning_team: number | null; win_type: string | null; player_stats: ApiRoundPlayerStat[] };

export async function getMapRoundsResponse(mapId: number): Promise<ApiRoundFullResponse[] | null> {
  if (!(await mapExists(mapId))) return null;

  const roundRows = await db
    .select({ id: mapRoundsRaw.id, roundNumber: mapRoundsRaw.roundNumber, winningEntrantId: mapRoundsRaw.winningEntrantId, winType: mapRoundsRaw.winType })
    .from(mapRoundsRaw)
    .where(eq(mapRoundsRaw.mapId, mapId))
    .orderBy(asc(mapRoundsRaw.roundNumber));

  const roundIds = roundRows.map((r) => r.id);
  const loadoutRows =
    roundIds.length > 0
      ? await db
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
          .where(inArray(mapRoundPlayerLoadoutsRaw.mapRoundId, roundIds))
      : [];

  const entrantIds = [...new Set(roundRows.map((r) => r.winningEntrantId).filter((id): id is number => id != null))];
  const teamByEntrant = await resolveEntrantTeamIds(entrantIds);

  const statsByRound = new Map<number, ApiRoundPlayerStat[]>();
  for (const row of loadoutRows) {
    const list = statsByRound.get(row.mapRoundId) ?? [];
    list.push({
      player_id: row.personId,
      kills: row.kills,
      assists: row.assists,
      score: row.score,
      economy_spent: row.economySpent,
      economy_remaining: row.economyRemaining,
      weapon_id: row.weapon,
      armor: row.armor,
    });
    statsByRound.set(row.mapRoundId, list);
  }

  return roundRows.map((row) => ({
    round_number: row.roundNumber,
    winning_team: row.winningEntrantId != null ? (teamByEntrant.get(row.winningEntrantId) ?? null) : null,
    win_type: row.winType,
    player_stats: statsByRound.get(row.id) ?? [],
  }));
}

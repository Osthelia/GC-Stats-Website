/**
 * GC-Stats - players
 *
 * Query helpers for the API v1 `/players` endpoints: search, single player
 * lookup with current team/logo/stats, and roster history resolution.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { people, rosterMemberships, teams, mapPlayerStats, maps, matches, stageContainers, stages } from "@gc-stats/db";
import { rangeIsOpen, rangeLower, rangeUpper } from "@/lib/daterange";
import { toApiPlayer, toApiTeam, type ApiPlayer, type ApiTeam } from "../entities";
import { getLogoUrls, getLogoUrlsBatch, getLogoHistoryResponse, type ApiLogoUrls, type ApiLogoHistoryResponse } from "../logo-response";
import { escapeLike, exclusiveUpperBound, type MapsFilter, type StatsFilter } from "../params";
import { fetchAvgStats, type ApiAvgStats } from "../avg-stats";
import { fetchWeaponStats, type ApiWeaponStatsEntry } from "../weapon-stats";
import { visiblePerson } from "@/lib/ghost-visibility";
import { rejectGhost } from "@/lib/api/v1/ghost";

async function personExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: people.id, isGhost: people.isGhost }).from(people).where(eq(people.id, id)).limit(1);
  rejectGhost(row, "player");
  return !!row;
}

export const PLAYER_ROSTER_ROLES = new Set(["player", "player-igl", "sub"]);

/** Batched "current team as a player" lookup — same theme-agnostic-first resolution isn't needed here (no theme concept on rosters), just the currently open player-role stint. */
async function getCurrentTeamsByPersonId(personIds: number[]): Promise<Map<number, ApiTeam | null>> {
  const result = new Map<number, ApiTeam | null>();
  for (const id of personIds) result.set(id, null);
  if (personIds.length === 0) return result;

  const rows = await db
    .select({
      personId: rosterMemberships.personId,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
      teamId: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      countryCode: teams.countryCode,
      socials: teams.socials,
      bio: teams.bio,
      vlrId: teams.vlrId,
      isActive: teams.isActive,
    })
    .from(rosterMemberships)
    .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .where(inArray(rosterMemberships.personId, personIds));

  for (const row of rows) {
    if (result.get(row.personId)) continue; // keep the first open player-role stint found
    if (!PLAYER_ROSTER_ROLES.has(row.role) || !rangeIsOpen(row.period)) continue;
    result.set(row.personId, toApiTeam({ id: row.teamId, name: row.name, shortName: row.shortName, countryCode: row.countryCode, socials: row.socials, bio: row.bio, vlrId: row.vlrId, isActive: row.isActive }));
  }
  return result;
}

export type ApiPlayerFullResponse = ApiPlayer & { current_team: ApiTeam | null; photo: ApiLogoUrls | null };

export async function searchPlayersByName(query: string): Promise<ApiPlayerFullResponse[]> {
  const pattern = `${escapeLike(query)}%`;
  const rows = await db.select().from(people).where(and(ilike(people.handle, pattern), visiblePerson)).limit(20);

  const ids = rows.map((r) => r.id);
  const [teamsByPersonId, photos] = await Promise.all([getCurrentTeamsByPersonId(ids), getLogoUrlsBatch("person", ids)]);

  return rows.map((row) => ({
    ...toApiPlayer(row),
    current_team: teamsByPersonId.get(row.id) ?? null,
    photo: photos.get(row.id) ?? null,
  }));
}

export async function getPlayerById(id: number): Promise<ApiPlayerFullResponse | null> {
  const [row] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  rejectGhost(row, "player");
  if (!row) return null;

  const [teamsByPersonId, photo] = await Promise.all([getCurrentTeamsByPersonId([id]), getLogoUrls("person", id)]);

  return { ...toApiPlayer(row), current_team: teamsByPersonId.get(id) ?? null, photo };
}

export type ApiPlayerTeamHistory = {
  team_id: number;
  team_name: string;
  team_short_name: string | null;
  team_country: string | null;
  role: string;
  joined_at: string | null;
  left_at: string | null;
};

/** Only player-role stints (not coach/manager/analyst) — same scope as V1's `player_team`, which never held staff. */
export async function getPlayerTeamHistory(personId: number): Promise<ApiPlayerTeamHistory[] | null> {
  if (!(await personExists(personId))) return null;

  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamShort: teams.shortName,
      teamCountry: teams.countryCode,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
    })
    .from(rosterMemberships)
    .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
    .where(eq(rosterMemberships.personId, personId))
    .orderBy(desc(rosterMemberships.period));

  return rows
    .filter((row) => PLAYER_ROSTER_ROLES.has(row.role))
    .map((row) => ({
      team_id: row.teamId,
      team_name: row.teamName,
      team_short_name: row.teamShort,
      team_country: row.teamCountry,
      role: row.role,
      joined_at: rangeLower(row.period),
      left_at: rangeUpper(row.period),
    }));
}

/** No existence gate — mirrors V1 (`/players/{id}/photos` never documented a 404, always 200 with an empty history). */
export async function getPlayerPhotoHistory(personId: number): Promise<ApiLogoHistoryResponse> {
  return getLogoHistoryResponse("person", personId);
}

/** Average stats for the player, always broken down by side (atk/def). */
export async function getPlayerStats(personId: number, filter: StatsFilter): Promise<ApiAvgStats | null> {
  if (!(await personExists(personId))) return null;
  return fetchAvgStats({ kind: "player", personId }, filter);
}

export type ApiAgentStatsEntry = {
  agent_name: string;
  maps_played: number;
  pickrate: number;
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
};

type AgentRow = {
  agentName: string | null;
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

/** Per-agent stats and pickrate for the player across all recorded maps. */
export async function getPlayerAgentStats(personId: number, filter: MapsFilter): Promise<ApiAgentStatsEntry[] | null> {
  if (!(await personExists(personId))) return null;

  const conditions = [eq(mapPlayerStats.personId, personId)];
  if (filter.from) conditions.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  if (filter.tournamentId) conditions.push(eq(stages.tournamentId, filter.tournamentId));

  const rows: AgentRow[] = await db
    .select({
      agentName: mapPlayerStats.agentName,
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
    .where(and(...conditions));

  const totalMaps = rows.length;
  const byAgent = new Map<string, AgentRow[]>();
  for (const row of rows) {
    const agent = row.agentName ?? "";
    const list = byAgent.get(agent) ?? [];
    list.push(row);
    byAgent.set(agent, list);
  }

  const entries = [...byAgent.entries()].map(([agentName, agentRows]) => {
    const mapsPlayed = agentRows.length;
    const sum = (f: (r: AgentRow) => number) => agentRows.reduce((acc, r) => acc + f(r), 0);
    const avg = (total: number) => (mapsPlayed > 0 ? total / mapsPlayed : 0);
    const totalKills = sum((r) => r.kills);
    const totalDeaths = sum((r) => r.deaths);
    const avgKills = avg(totalKills);
    const avgDeaths = avg(totalDeaths);
    const totalKast = sum((r) => Number(r.kastPercentage));
    const totalHs = sum((r) => Number(r.headshotPercentage));

    return {
      agent_name: agentName,
      maps_played: mapsPlayed,
      pickrate: totalMaps > 0 ? mapsPlayed / totalMaps : 0,
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
    };
  });

  return entries.sort((a, b) => b.maps_played - a.maps_played);
}

/** Weapon usage for the player — shared aggregation with `/teams/{id}/weapons` in `../weapon-stats.ts`. */
export async function getPlayerWeapons(personId: number, filter: MapsFilter): Promise<ApiWeaponStatsEntry[] | null> {
  if (!(await personExists(personId))) return null;
  return fetchWeaponStats({ kind: "player", personId }, filter);
}

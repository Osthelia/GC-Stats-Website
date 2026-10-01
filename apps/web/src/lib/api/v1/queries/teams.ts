/**
 * GC-Stats - teams
 *
 * Query helpers for the API v1 `/teams` endpoints: search, single team lookup
 * with roster/logo/stats, match history, vetoes and map/weapon breakdowns.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import {
  teams,
  people,
  rosterMemberships,
  entrants,
  matches,
  matchVetos,
  maps,
  mapPlayerStats,
  mapTeamRoundSummary,
  mapRoundsRaw,
  mapRoundPlayerLoadoutsRaw,
  stageContainers,
  stages,
} from "@gc-stats/db";
import { rangeIsOpen } from "@/lib/daterange";
import { toApiTeam, toApiTeamFromJoined, toApiPlayer, type ApiTeam, type ApiPlayer } from "../entities";
import { getLogoUrls, getLogoUrlsBatch, getLogoHistoryResponse, type ApiLogoUrls, type ApiLogoHistoryResponse } from "../logo-response";
import { escapeLike, exclusiveUpperBound, type MapsFilter, type StatsFilter, type MatchHistoryFilter } from "../params";
import { fetchAvgStats, type ApiAvgStats, type EntityScope } from "../avg-stats";
import { fetchWeaponStats, type ApiWeaponStatsEntry } from "../weapon-stats";
import { buildVetosByMatch, type ApiMatchVeto } from "./match-vetos";
import { ECO_TIERS, loadoutTierFor, type EcoTierKey } from "@/lib/eco-tiers";
import { visibleTeam } from "@/lib/ghost-visibility";
import { rejectGhost } from "@/lib/api/v1/ghost";

async function teamExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: teams.id, isGhost: teams.isGhost }).from(teams).where(eq(teams.id, id)).limit(1);
  rejectGhost(row, "team");
  return !!row;
}

/** A team can hold several `entrants` rows (one per tournament registration) — every map/match/veto stat is keyed by entrant, not team. */
async function getTeamEntrantIds(teamId: number, tournamentId?: number): Promise<number[]> {
  const conditions = [eq(entrants.teamId, teamId)];
  if (tournamentId) conditions.push(eq(entrants.tournamentId, tournamentId));
  const rows = await db
    .select({ id: entrants.id })
    .from(entrants)
    .where(and(...conditions));
  return rows.map((r) => r.id);
}

function matchDateConditions(filter: MapsFilter) {
  const conditions = [];
  if (filter.from) conditions.push(gte(matches.scheduledAt, new Date(`${filter.from}T00:00:00.000Z`)));
  if (filter.to) conditions.push(lt(matches.scheduledAt, exclusiveUpperBound(filter.to)));
  return conditions;
}

export type ApiTeamResponse = ApiTeam & { logo: ApiLogoUrls | null };

export async function searchTeamsByName(query: string): Promise<ApiTeamResponse[]> {
  const pattern = `${escapeLike(query)}%`;
  const rows = await db
    .select()
    .from(teams)
    .where(and(or(ilike(teams.name, pattern), ilike(teams.shortName, pattern)), visibleTeam))
    .limit(10);

  const logos = await getLogoUrlsBatch(
    "team",
    rows.map((r) => r.id),
  );
  return rows.map((row) => ({ ...toApiTeam(row), logo: logos.get(row.id) ?? null }));
}

export async function getTeamById(id: number): Promise<ApiTeamResponse | null> {
  const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  rejectGhost(row, "team");
  if (!row) return null;
  const logo = await getLogoUrls("team", id);
  return { ...toApiTeam(row), logo };
}

const PLAYER_ROSTER_ROLES = new Set(["player", "player-igl", "sub"]);

export type ApiTeamPlayersResponse = { current: ApiPlayer[]; history: ApiPlayer[] };

/** Only actual player roster slots — mirrors V1 (staff never joined a team's roster there, cf. SUIVI.md migration notes), excludes coach/manager/analyst. */
export async function getTeamPlayers(teamId: number): Promise<ApiTeamPlayersResponse | null> {
  if (!(await teamExists(teamId))) return null;

  const rows = await db
    .select({
      id: people.id,
      handle: people.handle,
      firstName: people.firstName,
      lastName: people.lastName,
      countryCode: people.countryCode,
      bio: people.bio,
      socials: people.socials,
      vlrId: people.vlrId,
      isActive: people.isActive,
      role: rosterMemberships.role,
      period: rosterMemberships.period,
    })
    .from(rosterMemberships)
    .innerJoin(people, eq(people.id, rosterMemberships.personId))
    .where(eq(rosterMemberships.teamId, teamId));

  const current: ApiPlayer[] = [];
  const history: ApiPlayer[] = [];
  for (const row of rows) {
    if (!PLAYER_ROSTER_ROLES.has(row.role)) continue;
    (rangeIsOpen(row.period) ? current : history).push(toApiPlayer(row));
  }
  return { current, history };
}

/** No existence gate — mirrors V1 (`/teams/{id}/logos` never documented a 404, always 200 with an empty history). */
export async function getTeamLogoHistory(teamId: number): Promise<ApiLogoHistoryResponse> {
  return getLogoHistoryResponse("team", teamId);
}

export type ApiTeamVetoEntry = { map_name: string; played: number; banned: number; pick: number; decider: number };

export async function getTeamVetos(teamId: number, filter: MapsFilter): Promise<ApiTeamVetoEntry[] | null> {
  if (!(await teamExists(teamId))) return null;
  const entrantIds = await getTeamEntrantIds(teamId, filter.tournamentId);
  if (entrantIds.length === 0) return [];

  const dateConds = matchDateConditions(filter);

  const playedRows = await db
    .select({ mapName: maps.mapName, played: sql<number>`count(*)` })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .where(
      and(
        or(inArray(matches.entrantAId, entrantIds), inArray(matches.entrantBId, entrantIds)),
        eq(maps.isCompleted, true),
        sql`${maps.teamAScore} >= 0 AND ${maps.teamBScore} >= 0`,
        ...dateConds,
      ),
    )
    .groupBy(maps.mapName);

  const vetoRows = await db
    .select({ mapName: matchVetos.mapName, type: matchVetos.type, cnt: sql<number>`count(*)` })
    .from(matchVetos)
    .innerJoin(matches, eq(matches.id, matchVetos.matchId))
    .where(and(inArray(matchVetos.entrantId, entrantIds), ...dateConds))
    .groupBy(matchVetos.mapName, matchVetos.type);

  const entries = new Map<string, ApiTeamVetoEntry>();
  for (const row of playedRows) {
    const mapName = row.mapName ?? "";
    entries.set(mapName, { map_name: mapName, played: Number(row.played), banned: 0, pick: 0, decider: 0 });
  }
  for (const row of vetoRows) {
    const entry = entries.get(row.mapName) ?? { map_name: row.mapName, played: 0, banned: 0, pick: 0, decider: 0 };
    if (row.type === "ban") entry.banned = Number(row.cnt);
    else if (row.type === "pick") entry.pick = Number(row.cnt);
    else if (row.type === "decider") entry.decider = Number(row.cnt);
    entries.set(row.mapName, entry);
  }

  return [...entries.values()].sort((a, b) => b.played - a.played || a.map_name.localeCompare(b.map_name));
}

export type ApiSideWinrate = { rounds_played: number; rounds_won: number; winrate: number };
export function sideWinrate(played: number, won: number): ApiSideWinrate {
  return { rounds_played: played, rounds_won: won, winrate: played > 0 ? won / played : 0 };
}

export type ApiCompEntry = {
  comp: string[];
  times_played: number;
  wins: number;
  losses: number;
  winrate: number;
  atk: ApiSideWinrate;
  def: ApiSideWinrate;
};

export type ApiEcoBreakdown = Record<EcoTierKey, ApiSideWinrate>;

export type ApiTeamMapEntry = {
  map_name: string;
  times_played: number;
  wins: number;
  losses: number;
  winrate: number;
  atk: ApiSideWinrate;
  def: ApiSideWinrate;
  eco: ApiEcoBreakdown;
  comps: ApiCompEntry[];
};

type EcoTally = Record<EcoTierKey, { played: number; won: number }>;
function emptyEcoTally(): EcoTally {
  return Object.fromEntries(ECO_TIERS.map((t) => [t.key, { played: 0, won: 0 }])) as EcoTally;
}

type MapSideTally = { atkPlayed: number; atkWon: number; defPlayed: number; defWon: number };
type MapNameAgg = MapSideTally & { mapName: string; timesPlayed: number; wins: number; eco: EcoTally; comps: Map<string, MapSideTally & { timesPlayed: number; wins: number }> };

/** Maps played by the team (winrate + atk/def winrate), with the comps played on each map nested inside. */
export async function getTeamMaps(teamId: number, filter: MapsFilter & { roundName?: string; stageId?: number }): Promise<ApiTeamMapEntry[] | null> {
  if (!(await teamExists(teamId))) return null;
  const entrantIds = await getTeamEntrantIds(teamId, filter.tournamentId);
  if (entrantIds.length === 0) return [];

  const dateConds = matchDateConditions(filter);
  const conditions = [or(inArray(matches.entrantAId, entrantIds), inArray(matches.entrantBId, entrantIds)), eq(maps.isCompleted, true), ...dateConds];
  if (filter.roundName) conditions.push(eq(matches.label, filter.roundName));
  if (filter.stageId) conditions.push(eq(stages.id, filter.stageId));

  const mapRows = await db
    .select({
      mapId: maps.id,
      mapName: maps.mapName,
      teamAScore: maps.teamAScore,
      teamBScore: maps.teamBScore,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
    })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(...conditions));

  if (mapRows.length === 0) return [];
  const mapIds = mapRows.map((r) => r.mapId);

  const [sideRows, compRows, rounds] = await Promise.all([
    db
      .select({ mapId: mapTeamRoundSummary.mapId, side: mapTeamRoundSummary.side, roundsPlayed: mapTeamRoundSummary.roundsPlayed, roundsWon: mapTeamRoundSummary.roundsWon })
      .from(mapTeamRoundSummary)
      .where(and(inArray(mapTeamRoundSummary.mapId, mapIds), inArray(mapTeamRoundSummary.entrantId, entrantIds))),
    db
      .select({ mapId: mapPlayerStats.mapId, agentName: mapPlayerStats.agentName })
      .from(mapPlayerStats)
      .where(and(inArray(mapPlayerStats.mapId, mapIds), inArray(mapPlayerStats.entrantId, entrantIds))),
    db
      .select({ id: mapRoundsRaw.id, mapId: mapRoundsRaw.mapId, winningEntrantId: mapRoundsRaw.winningEntrantId })
      .from(mapRoundsRaw)
      .where(inArray(mapRoundsRaw.mapId, mapIds)),
  ]);

  const roundIds = rounds.map((r) => r.id);
  const loadouts = roundIds.length
    ? await db
        .select({ mapRoundId: mapRoundPlayerLoadoutsRaw.mapRoundId, entrantId: mapRoundPlayerLoadoutsRaw.entrantId, loadoutValue: mapRoundPlayerLoadoutsRaw.loadoutValue })
        .from(mapRoundPlayerLoadoutsRaw)
        .where(inArray(mapRoundPlayerLoadoutsRaw.mapRoundId, roundIds))
    : [];

  const spentByRoundEntrant = new Map<string, number>();
  for (const l of loadouts) {
    if (l.entrantId == null || l.loadoutValue == null) continue;
    const key = `${l.mapRoundId}:${l.entrantId}`;
    spentByRoundEntrant.set(key, (spentByRoundEntrant.get(key) ?? 0) + l.loadoutValue);
  }
  const roundsByMapId = new Map<number, typeof rounds>();
  for (const r of rounds) roundsByMapId.set(r.mapId, [...(roundsByMapId.get(r.mapId) ?? []), r]);

  const compByMapId = new Map<number, string[]>();
  for (const row of compRows) {
    if (!row.agentName) continue;
    const list = compByMapId.get(row.mapId) ?? [];
    if (!list.includes(row.agentName)) list.push(row.agentName);
    compByMapId.set(row.mapId, list);
  }
  for (const [id, list] of compByMapId) compByMapId.set(id, [...list].sort());

  const sideByMapId = new Map<number, MapSideTally>();
  for (const row of sideRows) {
    const entry = sideByMapId.get(row.mapId) ?? { atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0 };
    if (row.side === "atk") {
      entry.atkPlayed += row.roundsPlayed;
      entry.atkWon += row.roundsWon;
    } else {
      entry.defPlayed += row.roundsPlayed;
      entry.defWon += row.roundsWon;
    }
    sideByMapId.set(row.mapId, entry);
  }

  const byMapName = new Map<string, MapNameAgg>();
  for (const row of mapRows) {
    const mapName = row.mapName ?? "";
    const isEntrantA = row.entrantAId != null && entrantIds.includes(row.entrantAId);
    const ourScore = isEntrantA ? row.teamAScore : row.teamBScore;
    const oppScore = isEntrantA ? row.teamBScore : row.teamAScore;
    const won = ourScore != null && oppScore != null && ourScore > oppScore;
    const side = sideByMapId.get(row.mapId) ?? { atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0 };
    const comp = compByMapId.get(row.mapId) ?? [];
    const compKey = comp.join(",");
    const ourEntrantId = isEntrantA ? row.entrantAId : row.entrantBId;

    const agg = byMapName.get(mapName) ?? { mapName, timesPlayed: 0, wins: 0, atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0, eco: emptyEcoTally(), comps: new Map() };
    agg.timesPlayed += 1;
    if (won) agg.wins += 1;
    agg.atkPlayed += side.atkPlayed;
    agg.atkWon += side.atkWon;
    agg.defPlayed += side.defPlayed;
    agg.defWon += side.defWon;

    if (ourEntrantId != null) {
      for (const round of roundsByMapId.get(row.mapId) ?? []) {
        const spent = spentByRoundEntrant.get(`${round.id}:${ourEntrantId}`) ?? 0;
        const tier = loadoutTierFor(spent);
        if (!tier) continue;
        agg.eco[tier].played++;
        if (round.winningEntrantId === ourEntrantId) agg.eco[tier].won++;
      }
    }

    if (comp.length > 0) {
      const compAgg = agg.comps.get(compKey) ?? { timesPlayed: 0, wins: 0, atkPlayed: 0, atkWon: 0, defPlayed: 0, defWon: 0 };
      compAgg.timesPlayed += 1;
      if (won) compAgg.wins += 1;
      compAgg.atkPlayed += side.atkPlayed;
      compAgg.atkWon += side.atkWon;
      compAgg.defPlayed += side.defPlayed;
      compAgg.defWon += side.defWon;
      agg.comps.set(compKey, compAgg);
    }

    byMapName.set(mapName, agg);
  }

  return [...byMapName.values()]
    .map((agg) => ({
      map_name: agg.mapName,
      times_played: agg.timesPlayed,
      wins: agg.wins,
      losses: agg.timesPlayed - agg.wins,
      winrate: agg.timesPlayed > 0 ? agg.wins / agg.timesPlayed : 0,
      atk: sideWinrate(agg.atkPlayed, agg.atkWon),
      def: sideWinrate(agg.defPlayed, agg.defWon),
      eco: Object.fromEntries(ECO_TIERS.map((t) => [t.key, sideWinrate(agg.eco[t.key].played, agg.eco[t.key].won)])) as ApiEcoBreakdown,
      comps: [...agg.comps.entries()]
        .map(([key, c]) => ({
          comp: key.split(","),
          times_played: c.timesPlayed,
          wins: c.wins,
          losses: c.timesPlayed - c.wins,
          winrate: c.timesPlayed > 0 ? c.wins / c.timesPlayed : 0,
          atk: sideWinrate(c.atkPlayed, c.atkWon),
          def: sideWinrate(c.defPlayed, c.defWon),
        }))
        .sort((a, b) => b.times_played - a.times_played),
    }))
    .sort((a, b) => b.times_played - a.times_played);
}

/** Weapon usage for the team — shared aggregation with `/players/{id}/weapons` in `../weapon-stats.ts`. */
export async function getTeamWeapons(teamId: number, filter: MapsFilter): Promise<ApiWeaponStatsEntry[] | null> {
  if (!(await teamExists(teamId))) return null;
  const entrantIds = await getTeamEntrantIds(teamId, filter.tournamentId);
  return fetchWeaponStats({ kind: "team", entrantIds }, filter);
}

export type ApiSituationEntry = { played: number; won: number; winrate: number };
export type ApiSideSituations = { atk: Record<string, ApiSituationEntry>; def: Record<string, ApiSituationEntry> };
export type ApiPostPlantStats = { played: number; won: number; winrate: number };
export type ApiSidePostPlant = { atk: ApiPostPlantStats; def: ApiPostPlantStats };
export type ApiTeamStatsResponse = ApiAvgStats & { situations: ApiSideSituations; post_plant: ApiSidePostPlant };

const MAX_ALIVE_PER_SIDE = 5;
type AliveRow = { round_id: number; winning_entrant_id: number | null; atk_alive: number | null; def_alive: number | null };

async function fetchSituationsForSide(entrantIds: number[], filter: StatsFilter, side: "atk" | "def"): Promise<Record<string, ApiSituationEntry>> {
  const entries: Record<string, ApiSituationEntry> = {};
  for (let teamAlive = 0; teamAlive <= MAX_ALIVE_PER_SIDE; teamAlive++) {
    for (let enemyAlive = 0; enemyAlive <= MAX_ALIVE_PER_SIDE; enemyAlive++) {
      entries[`${teamAlive}v${enemyAlive}`] = { played: 0, won: 0, winrate: 0 };
    }
  }
  if (entrantIds.length === 0) return entries;

  const sideCol = side === "atk" ? sql`r.atk_entrant_id` : sql`r.def_entrant_id`;
  const result = await db.execute<AliveRow>(sql`
    SELECT r.id AS round_id, r.winning_entrant_id AS winning_entrant_id, a.atk_alive AS atk_alive, a.def_alive AS def_alive
    FROM map_rounds_raw r
    JOIN maps gm ON gm.id = r.map_id
    JOIN matches m ON m.id = gm.match_id
    LEFT JOIN map_round_alive_states_raw a ON a.map_round_id = r.id
    WHERE ${sideCol} = ANY(${entrantIds}::bigint[])
      ${filter.from ? sql`AND m.scheduled_at >= ${new Date(`${filter.from}T00:00:00.000Z`)}` : sql``}
      ${filter.to ? sql`AND m.scheduled_at < ${exclusiveUpperBound(filter.to)}` : sql``}
    ORDER BY r.id, a.sequence ASC
  `);

  const tally = new Map<string, { played: number; won: number }>();

  let currentRound: number | null = null;
  let visited = new Set<string>();
  let roundWon = false;

  const flush = () => {
    for (const key of visited) {
      const entry = tally.get(key) ?? { played: 0, won: 0 };
      entry.played += 1;
      if (roundWon) entry.won += 1;
      tally.set(key, entry);
    }
  };

  for (const row of result.rows) {
    if (currentRound !== row.round_id) {
      if (currentRound !== null) flush();
      currentRound = row.round_id;
      visited = new Set();
      roundWon = row.winning_entrant_id != null && entrantIds.includes(row.winning_entrant_id);
    }
    if (row.atk_alive == null || row.def_alive == null) continue;
    const [teamAlive, enemyAlive] = side === "atk" ? [row.atk_alive, row.def_alive] : [row.def_alive, row.atk_alive];
    visited.add(`${teamAlive}v${enemyAlive}`);
  }
  if (currentRound !== null) flush();

  for (const [key, { played, won }] of tally) {
    entries[key] = { played, won, winrate: played > 0 ? won / played : 0 };
  }
  return entries;
}

async function fetchTeamSituations(entrantIds: number[], filter: StatsFilter): Promise<ApiSideSituations> {
  const [atk, def] = await Promise.all([fetchSituationsForSide(entrantIds, filter, "atk"), fetchSituationsForSide(entrantIds, filter, "def")]);
  return { atk, def };
}

async function fetchPostPlantForSide(entrantIds: number[], filter: StatsFilter, side: "atk" | "def"): Promise<ApiPostPlantStats> {
  if (entrantIds.length === 0) return { played: 0, won: 0, winrate: 0 };
  const sideCol = side === "atk" ? sql`r.atk_entrant_id` : sql`r.def_entrant_id`;

  const result = await db.execute<{ played: number; won: number }>(sql`
    SELECT COUNT(*)::int AS played,
      COALESCE(SUM(CASE WHEN r.winning_entrant_id = ANY(${entrantIds}::bigint[]) THEN 1 ELSE 0 END), 0)::int AS won
    FROM map_rounds_raw r
    JOIN maps gm ON gm.id = r.map_id
    JOIN matches m ON m.id = gm.match_id
    WHERE r.plant_site IS NOT NULL AND ${sideCol} = ANY(${entrantIds}::bigint[])
      ${filter.from ? sql`AND m.scheduled_at >= ${new Date(`${filter.from}T00:00:00.000Z`)}` : sql``}
      ${filter.to ? sql`AND m.scheduled_at < ${exclusiveUpperBound(filter.to)}` : sql``}
  `);
  const row = result.rows[0];
  const played = Number(row?.played ?? 0);
  const won = Number(row?.won ?? 0);
  return { played, won, winrate: played > 0 ? won / played : 0 };
}

async function fetchTeamPostPlant(entrantIds: number[], filter: StatsFilter): Promise<ApiSidePostPlant> {
  const [atk, def] = await Promise.all([fetchPostPlantForSide(entrantIds, filter, "atk"), fetchPostPlantForSide(entrantIds, filter, "def")]);
  return { atk, def };
}

/** Average stats for the team, always broken down by side (atk/def), plus XvY situations and post-plant performance. */
export async function getTeamStats(teamId: number, filter: StatsFilter): Promise<ApiTeamStatsResponse | null> {
  if (!(await teamExists(teamId))) return null;
  const entrantIds = await getTeamEntrantIds(teamId, filter.tournamentId);
  const scope: EntityScope = { kind: "team", entrantIds };

  const [avg, situations, postPlant] = await Promise.all([fetchAvgStats(scope, filter), fetchTeamSituations(entrantIds, filter), fetchTeamPostPlant(entrantIds, filter)]);

  return { ...avg, situations, post_plant: postPlant };
}

export type ApiTeamWithScore = { team: ApiTeam; score: number | null };
export type ApiTeamMatchEntry = {
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
  vetos: ApiMatchVeto[];
};
export type ApiPaginatedTeamMatches = { page: number; per_page: number; total: number; total_pages: number; data: ApiTeamMatchEntry[] };

const entrantAAlias = alias(entrants, "entrant_a");
const entrantBAlias = alias(entrants, "entrant_b");
const teamAAlias = alias(teams, "match_team_a");
const teamBAlias = alias(teams, "match_team_b");

/** Paginated match history for the team, most recent first, each with its vetoes in order. */
export async function getTeamMatches(teamId: number, query: MatchHistoryFilter): Promise<ApiPaginatedTeamMatches | null> {
  if (!(await teamExists(teamId))) return null;

  const entrantIds = await getTeamEntrantIds(teamId, query.tournamentId);
  if (entrantIds.length === 0) return { page: query.page, per_page: query.perPage, total: 0, total_pages: 0, data: [] };

  const conditions = [or(inArray(matches.entrantAId, entrantIds), inArray(matches.entrantBId, entrantIds)), ...matchDateConditions(query)];
  if (query.status) conditions.push(eq(matches.status, query.status as "pending" | "live" | "completed"));
  if (query.roundName) conditions.push(eq(matches.label, query.roundName));

  if (query.opponentId) {
    const opponentEntrants = await db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, query.opponentId));
    const opponentIds = opponentEntrants.map((e) => e.id);
    conditions.push(opponentIds.length > 0 ? or(inArray(matches.entrantAId, opponentIds), inArray(matches.entrantBId, opponentIds)) : sql`false`);
  }

  if (query.stageId) {
    const containerRows = await db.select({ id: stageContainers.id }).from(stageContainers).where(eq(stageContainers.stageId, query.stageId));
    const containerIds = containerRows.map((c) => c.id);
    conditions.push(containerIds.length > 0 ? inArray(matches.containerId, containerIds) : sql`false`);
  }

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(matches)
    .where(and(...conditions));

  const total = Number(countRow?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / query.perPage) : 0;

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(desc(matches.scheduledAt), desc(matches.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  const matchIds = rows.map((r) => r.id);
  const vetosByMatch = await buildVetosByMatch(matchIds);

  const data: ApiTeamMatchEntry[] = rows.map((row) => {
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
      vetos: vetosByMatch.get(row.id) ?? [],
    };
  });

  return { page: query.page, per_page: query.perPage, total, total_pages: totalPages, data };
}

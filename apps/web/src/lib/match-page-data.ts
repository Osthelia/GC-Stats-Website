/**
 * GC-Stats - match-page-data
 *
 * All data queries for the /match page: header, vetos, per-map/aggregated
 * player stats, rounds/performance/eco stats batched across maps, past
 * encounters, head to head map comparison, streams, VODs and player POVs.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { unstable_cache } from "next/cache";
import { db } from "@gc-stats/db/client";
import {
  matches,
  entrants,
  teams,
  tournaments,
  stages,
  stageContainers,
  matchVetos,
  maps,
  mapPlayerStats,
  mapTeamRoundSummary,
  mapRoundsRaw,
  mapRoundPlayerLoadoutsRaw,
  mapRoundKillsRaw,
  people,
  streamChannels,
  matchStreams,
  vods,
  matchPlayerPovs,
} from "@gc-stats/db";
import { buildTeamDisplayResolver, type TeamDisplayResolver } from "@/lib/historical-team-display";
import {
  ECO_TIERS,
  loadoutTierFor,
  emptyEcoTierSummary,
  type EcoTierKey,
  type EcoTierSummary,
} from "@/lib/eco-tiers";
import { knownScheduledAt } from "@/lib/match-schedule";
import { MATCH_STATS_TAG, matchTag } from "@/lib/cache-tags";

export { ECO_TIERS, emptyEcoTierSummary, type EcoTierKey, type EcoTierSummary };

export type MatchSide = {
  entrantId: number | null;
  displayName: string;
  teamId: number | null;
  /** Ghost team: rendered without a link to its (non existent) page. */
  isGhost: boolean;
  shortName: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
};

export type MatchHeader = {
  id: number;
  status: "pending" | "live" | "completed";
  bestOf: number;
  round: number;
  label: string | null;
  scheduledAt: Date | null;
  patch: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  a: MatchSide;
  b: MatchSide;
  tournamentId: number;
  tournamentName: string;
  /** Uncovered mix tournament: no tournament page to link to. */
  tournamentIsGhost: boolean;
  region: string | null;
  stageId: number;
  stageName: string;
  containerName: string;
};

const TBD_SIDE: Omit<MatchSide, "entrantId"> = {
  displayName: "TBD",
  teamId: null,
  isGhost: false,
  shortName: null,
  countryCode: null,
  logoUrl: null,
  logoUrlLight: null,
};

type HeaderSideRow = {
  entrantId: number | null;
  displayName: string | null;
  teamId: number | null;
  isGhost: boolean | null;
  shortName: string | null;
  countryCode: string | null;
};

function resolveSide(
  side: HeaderSideRow,
  at: Date,
  resolver: TeamDisplayResolver,
): MatchSide {
  if (side.entrantId == null || side.displayName == null) {
    return { entrantId: side.entrantId, ...TBD_SIDE };
  }
  if (side.teamId == null) {
    return {
      ...TBD_SIDE,
      entrantId: side.entrantId,
      displayName: side.displayName,
    };
  }
  const themed = resolver.logosAt(side.teamId, at);
  return {
    entrantId: side.entrantId,
    displayName: resolver.nameAt(side.teamId, at, side.displayName),
    teamId: side.teamId,
    isGhost: side.isGhost ?? false,
    shortName: side.shortName,
    countryCode: side.countryCode,
    logoUrl: themed.dark,
    logoUrlLight: themed.light,
  };
}

export const getMatchHeader = cache(async (
  matchId: number,
): Promise<MatchHeader | null> => {
  const entrantA = alias(entrants, "header_entrant_a");
  const entrantB = alias(entrants, "header_entrant_b");
  const teamA = alias(teams, "header_team_a");
  const teamB = alias(teams, "header_team_b");
  const [row] = await db
    .select({
      id: matches.id,
      status: matches.status,
      bestOf: matches.bestOf,
      round: matches.round,
      label: matches.label,
      scheduledAt: matches.scheduledAt,
      patch: matches.patch,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      winnerId: matches.winnerId,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      tournamentIsGhost: tournaments.isGhost,
      region: tournaments.region,
      stageId: stages.id,
      stageName: stages.name,
      containerName: stageContainers.name,
      a: {
        entrantId: matches.entrantAId,
        displayName: entrantA.displayName,
        teamId: entrantA.teamId,
        isGhost: teamA.isGhost,
        shortName: teamA.shortName,
        countryCode: teamA.countryCode,
      },
      b: {
        entrantId: matches.entrantBId,
        displayName: entrantB.displayName,
        teamId: entrantB.teamId,
        isGhost: teamB.isGhost,
        shortName: teamB.shortName,
        countryCode: teamB.countryCode,
      },
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
    .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
    .leftJoin(teamA, eq(teamA.id, entrantA.teamId))
    .leftJoin(teamB, eq(teamB.id, entrantB.teamId))
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!row) return null;

  const at = row.scheduledAt ?? new Date();
  const resolver = await buildTeamDisplayResolver(
    [row.a.teamId, row.b.teamId].filter((id): id is number => id != null),
  );

  return {
    id: row.id,
    status: row.status,
    bestOf: row.bestOf,
    round: row.round,
    label: row.label,
    scheduledAt: knownScheduledAt(row.scheduledAt),
    patch: row.patch,
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    winnerId: row.winnerId,
    a: resolveSide(row.a, at, resolver),
    b: resolveSide(row.b, at, resolver),
    tournamentId: row.tournamentId,
    tournamentName: row.tournamentName,
    tournamentIsGhost: row.tournamentIsGhost,
    region: row.region,
    stageId: row.stageId,
    stageName: row.stageName,
    containerName: row.containerName,
  };
});

export type MatchVetoStep = {
  order: number;
  type: string;
  mapName: string;
  side: string | null;
  entrantId: number;
  isTeamA: boolean;
  sidePickedByEntrantId: number | null;
  sidePickedByIsTeamA: boolean;
};

export async function getMatchVetos(
  matchId: number,
  entrantAId: number | null,
): Promise<MatchVetoStep[]> {
  const rows = await db
    .select({
      order: matchVetos.order,
      type: matchVetos.type,
      mapName: matchVetos.mapName,
      side: matchVetos.side,
      entrantId: matchVetos.entrantId,
      sidePickedByEntrantId: matchVetos.sidePickedByEntrantId,
    })
    .from(matchVetos)
    .where(eq(matchVetos.matchId, matchId))
    .orderBy(asc(matchVetos.order));

  return rows.map((r) => ({
    ...r,
    isTeamA: entrantAId != null && r.entrantId === entrantAId,
    sidePickedByIsTeamA:
      entrantAId != null && r.sidePickedByEntrantId === entrantAId,
  }));
}

export type MatchMapPlayerRow = {
  entrantId: number;
  personId: number | null;
  /** Ghost player: shown without a link to a profile. */
  isGhost: boolean;
  handle: string;
  agentName: string | null;
  agents: string[];
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kastPercentage: number;
  firstKills: number;
  firstDeaths: number;
  headshotPercentage: number;
  clutchesWon: number;
  clutchesPlayed: number;
};

type ClutchesJson = Record<string, { won?: number; total?: number }>;

/** Sums the per situation clutches (1v1 to 1v5) stored as `{"1v1": {won, total}, ...}`. */
function sumClutches(clutches: unknown): { won: number; played: number } {
  let won = 0;
  let played = 0;
  for (const c of Object.values((clutches ?? {}) as ClutchesJson)) {
    won += Number(c?.won ?? 0);
    played += Number(c?.total ?? 0);
  }
  return { won, played };
}

export type MatchMap = {
  id: number;
  order: number;
  mapName: string;
  isCompleted: boolean;
  teamAScore: number | null;
  teamBScore: number | null;
  sideA: string | null;
  sideB: string | null;
  note: string | null;
  playersA: MatchMapPlayerRow[];
  playersB: MatchMapPlayerRow[];
};

export async function getMatchMaps(
  matchId: number,
  entrantAId: number | null,
  entrantBId: number | null,
): Promise<MatchMap[]> {
  const rows = await db
    .select({
      id: maps.id,
      order: maps.order,
      isCompleted: maps.isCompleted,
      teamAScore: maps.teamAScore,
      teamBScore: maps.teamBScore,
      mapName: maps.mapName,
      note: maps.note,
    })
    .from(maps)
    .where(eq(maps.matchId, matchId))
    .orderBy(asc(maps.order));

  if (rows.length === 0) return [];
  const mapIds = rows.map((r) => r.id);

  const [roundSummary, statRows] = await Promise.all([
    db
      .select({
        mapId: mapTeamRoundSummary.mapId,
        entrantId: mapTeamRoundSummary.entrantId,
        side: mapTeamRoundSummary.side,
      })
      .from(mapTeamRoundSummary)
      .where(inArray(mapTeamRoundSummary.mapId, mapIds)),
    db
      .select({
        mapId: mapPlayerStats.mapId,
        entrantId: mapPlayerStats.entrantId,
        personId: mapPlayerStats.personId,
        isGhost: people.isGhost,
        handle: people.handle,
        agentName: mapPlayerStats.agentName,
        kills: mapPlayerStats.kills,
        deaths: mapPlayerStats.deaths,
        assists: mapPlayerStats.assists,
        acs: mapPlayerStats.acs,
        adr: mapPlayerStats.adr,
        kastPercentage: mapPlayerStats.kastPercentage,
        firstKills: mapPlayerStats.firstKills,
        firstDeaths: mapPlayerStats.firstDeaths,
        headshotPercentage: mapPlayerStats.headshotPercentage,
        clutches: mapPlayerStats.clutches,
      })
      .from(mapPlayerStats)
      .leftJoin(people, eq(people.id, mapPlayerStats.personId))
      .where(inArray(mapPlayerStats.mapId, mapIds))
      .orderBy(asc(mapPlayerStats.mapId)),
  ]);
  const sideByMapEntrant = new Map(
    roundSummary.map((r) => [`${r.mapId}:${r.entrantId}`, r.side]),
  );

  return rows.map((r) => {
    const players = statRows
      .filter((s) => s.mapId === r.id)
      .map(({ clutches, ...s }) => ({
        ...s,
        clutchesWon: sumClutches(clutches).won,
        clutchesPlayed: sumClutches(clutches).played,
        isGhost: s.isGhost ?? false,
        handle: s.handle ?? "?",
        agents: s.agentName ? [s.agentName] : [],
        kastPercentage: Number(s.kastPercentage),
        headshotPercentage: Number(s.headshotPercentage),
      }))
      .sort((a, b) => b.acs - a.acs);

    return {
      id: r.id,
      order: r.order,
      mapName: r.mapName ?? "—",
      isCompleted: r.isCompleted,
      teamAScore: r.teamAScore,
      teamBScore: r.teamBScore,
      sideA:
        entrantAId != null
          ? (sideByMapEntrant.get(`${r.id}:${entrantAId}`) ?? null)
          : null,
      sideB:
        entrantBId != null
          ? (sideByMapEntrant.get(`${r.id}:${entrantBId}`) ?? null)
          : null,
      note: r.note,
      playersA: players.filter((p) => p.entrantId === entrantAId),
      playersB: players.filter((p) => p.entrantId === entrantBId),
    };
  });
}

/**
 * Maps and per map stats of a completed match, cached a day. Invalidated by the admin match
 * and map fetch actions (`match:{id}`) and by player handle edits (`match-stats`).
 */
export function getCompletedMatchStats(
  matchId: number,
  entrantAId: number | null,
  entrantBId: number | null,
): Promise<[MatchMap[], MatchMapsStats]> {
  return unstable_cache(
    () =>
      Promise.all([
        getMatchMaps(matchId, entrantAId, entrantBId),
        getMatchMapsStatsBatch(matchId, entrantAId, entrantBId),
      ]),
    ["completed-match-stats-v2", String(matchId), String(entrantAId), String(entrantBId)],
    { tags: [matchTag(matchId), MATCH_STATS_TAG], revalidate: 86400 },
  )();
}

/** "All Maps" tab: per-player totals across every completed map of the match (mirror V1's aggregated face-to-face table), from the rows `getMatchMaps` already loaded. */
export function aggregateMatchStats(
  matchMaps: MatchMap[],
  entrantAId: number | null,
  entrantBId: number | null,
): { playersA: MatchMapPlayerRow[]; playersB: MatchMapPlayerRow[] } {
  const statRows = matchMaps.filter((m) => m.isCompleted).flatMap((m) => [...m.playersA, ...m.playersB]);

  const byPerson = new Map<
    string,
    {
      entrantId: number;
      personId: number | null;
      isGhost: boolean;
      handle: string;
      agents: Set<string>;
      kills: number;
      deaths: number;
      assists: number;
      acsSum: number;
      adrSum: number;
      kastSum: number;
      hsSum: number;
      firstKills: number;
      firstDeaths: number;
      clutchesWon: number;
      clutchesPlayed: number;
      n: number;
    }
  >();

  for (const s of statRows) {
    const key =
      s.personId != null
        ? `p${s.personId}`
        : `e${s.entrantId}:${s.handle ?? "?"}`;
    const agg = byPerson.get(key) ?? {
      entrantId: s.entrantId,
      personId: s.personId,
      isGhost: s.isGhost,
      handle: s.handle ?? "?",
      agents: new Set<string>(),
      kills: 0,
      deaths: 0,
      assists: 0,
      acsSum: 0,
      adrSum: 0,
      kastSum: 0,
      hsSum: 0,
      firstKills: 0,
      firstDeaths: 0,
      clutchesWon: 0,
      clutchesPlayed: 0,
      n: 0,
    };
    if (s.agentName) agg.agents.add(s.agentName);
    agg.kills += s.kills;
    agg.deaths += s.deaths;
    agg.assists += s.assists;
    agg.acsSum += s.acs;
    agg.adrSum += s.adr;
    agg.kastSum += Number(s.kastPercentage);
    agg.hsSum += Number(s.headshotPercentage);
    agg.firstKills += s.firstKills;
    agg.firstDeaths += s.firstDeaths;
    agg.clutchesWon += s.clutchesWon;
    agg.clutchesPlayed += s.clutchesPlayed;
    agg.n += 1;
    byPerson.set(key, agg);
  }

  const players: MatchMapPlayerRow[] = Array.from(byPerson.values()).map(
    (a) => ({
      entrantId: a.entrantId,
      personId: a.personId,
      isGhost: a.isGhost,
      handle: a.handle,
      agentName: null,
      agents: Array.from(a.agents),
      kills: a.kills,
      deaths: a.deaths,
      assists: a.assists,
      acs: Math.round(a.acsSum / a.n),
      adr: Math.round(a.adrSum / a.n),
      kastPercentage: a.kastSum / a.n,
      firstKills: a.firstKills,
      firstDeaths: a.firstDeaths,
      headshotPercentage: a.hsSum / a.n,
      clutchesWon: a.clutchesWon,
      clutchesPlayed: a.clutchesPlayed,
    }),
  );

  return {
    playersA: players
      .filter((p) => p.entrantId === entrantAId)
      .sort((a, b) => b.acs - a.acs),
    playersB: players
      .filter((p) => p.entrantId === entrantBId)
      .sort((a, b) => b.acs - a.acs),
  };
}

export type MatchRound = {
  roundNumber: number;
  winningEntrantId: number | null;
  winType: string | null;
};

export async function getMatchMapRounds(mapId: number): Promise<MatchRound[]> {
  const rows = await db
    .select({
      roundNumber: mapRoundsRaw.roundNumber,
      winningEntrantId: mapRoundsRaw.winningEntrantId,
      winType: mapRoundsRaw.winType,
    })
    .from(mapRoundsRaw)
    .where(eq(mapRoundsRaw.mapId, mapId))
    .orderBy(asc(mapRoundsRaw.roundNumber));
  return rows;
}

export type MatchMapsStats = {
  roundsByMapId: Record<number, MatchRound[]>;
  performanceByMapId: Record<number, MatchPerformance>;
  ecoByMapId: Record<number, MatchEcoSummary>;
  aggregatedPerformance: MatchPerformance;
  aggregatedEco: MatchEcoSummary;
};

/**
 * Rounds/performance/eco for every completed map of the match, plus the "All Maps" aggregate,
 * in 4 parallel queries regardless of map count. Starts from the match id so it doesn't wait
 * for `getMatchMaps`.
 */
export async function getMatchMapsStatsBatch(
  matchId: number,
  entrantAId: number | null,
  entrantBId: number | null,
): Promise<MatchMapsStats> {
  const completedMaps = db
    .select({ id: maps.id })
    .from(maps)
    .where(and(eq(maps.matchId, matchId), eq(maps.isCompleted, true)));
  const matchRoundIds = db
    .select({ id: mapRoundsRaw.id })
    .from(mapRoundsRaw)
    .where(inArray(mapRoundsRaw.mapId, completedMaps));

  const [mapRows, rounds, loadouts, sheriffKills] = await Promise.all([
    completedMaps,
    db
      .select({
        id: mapRoundsRaw.id,
        mapId: mapRoundsRaw.mapId,
        roundNumber: mapRoundsRaw.roundNumber,
        winningEntrantId: mapRoundsRaw.winningEntrantId,
        winType: mapRoundsRaw.winType,
      })
      .from(mapRoundsRaw)
      .where(inArray(mapRoundsRaw.mapId, completedMaps))
      .orderBy(asc(mapRoundsRaw.roundNumber)),
    db
      .select({
        mapRoundId: mapRoundPlayerLoadoutsRaw.mapRoundId,
        entrantId: mapRoundPlayerLoadoutsRaw.entrantId,
        personId: mapRoundPlayerLoadoutsRaw.personId,
        kills: mapRoundPlayerLoadoutsRaw.kills,
        loadoutValue: mapRoundPlayerLoadoutsRaw.loadoutValue,
      })
      .from(mapRoundPlayerLoadoutsRaw)
      .where(inArray(mapRoundPlayerLoadoutsRaw.mapRoundId, matchRoundIds)),
    // Only Sheriff kills are shown, no need to load the rest.
    db
      .select({
        mapRoundId: mapRoundKillsRaw.mapRoundId,
        killerPersonId: mapRoundKillsRaw.killerPersonId,
      })
      .from(mapRoundKillsRaw)
      .where(
        and(
          inArray(mapRoundKillsRaw.mapRoundId, matchRoundIds),
          eq(mapRoundKillsRaw.weapon, "Sheriff"),
          isNotNull(mapRoundKillsRaw.killerPersonId),
        ),
      ),
  ]);
  const mapIds = mapRows.map((m) => m.id);

  const roundsByMapId: Record<number, MatchRound[]> = {};
  const performanceByMapId: Record<number, MatchPerformance> = {};
  const ecoByMapId: Record<number, MatchEcoSummary> = {};
  for (const id of mapIds) {
    roundsByMapId[id] = [];
    performanceByMapId[id] = {};
    ecoByMapId[id] = emptyMatchEcoSummary();
  }
  const aggregatedPerformance: MatchPerformance = {};
  const aggregatedEco = emptyMatchEcoSummary();
  if (mapIds.length === 0)
    return {
      roundsByMapId,
      performanceByMapId,
      ecoByMapId,
      aggregatedPerformance,
      aggregatedEco,
    };

  for (const r of rounds) {
    roundsByMapId[r.mapId]?.push({
      roundNumber: r.roundNumber,
      winningEntrantId: r.winningEntrantId,
      winType: r.winType,
    });
  }
  if (rounds.length === 0)
    return {
      roundsByMapId,
      performanceByMapId,
      ecoByMapId,
      aggregatedPerformance,
      aggregatedEco,
    };
  const roundById = new Map(rounds.map((r) => [r.id, r]));

  const ensurePerf = (perf: MatchPerformance, personId: number) =>
    (perf[personId] ??= { sheriffKills: 0, k2: 0, k3: 0, k4: 0, k5: 0 });

  const spentByRoundEntrant = new Map<string, number>();
  for (const l of loadouts) {
    const round = roundById.get(l.mapRoundId);
    if (round && l.personId != null) {
      const perMap = ensurePerf(
        (performanceByMapId[round.mapId] ??= {}),
        l.personId,
      );
      const overall = ensurePerf(aggregatedPerformance, l.personId);
      if (l.kills === 2) {
        perMap.k2++;
        overall.k2++;
      } else if (l.kills === 3) {
        perMap.k3++;
        overall.k3++;
      } else if (l.kills === 4) {
        perMap.k4++;
        overall.k4++;
      } else if (l.kills >= 5) {
        perMap.k5++;
        overall.k5++;
      }
    }
    if (l.entrantId != null && l.loadoutValue != null) {
      const key = `${l.mapRoundId}:${l.entrantId}`;
      spentByRoundEntrant.set(
        key,
        (spentByRoundEntrant.get(key) ?? 0) + l.loadoutValue,
      );
    }
  }

  for (const k of sheriffKills) {
    if (k.killerPersonId == null) continue;
    const round = roundById.get(k.mapRoundId);
    if (!round) continue;
    ensurePerf((performanceByMapId[round.mapId] ??= {}), k.killerPersonId)
      .sheriffKills++;
    ensurePerf(aggregatedPerformance, k.killerPersonId).sheriffKills++;
  }

  if (entrantAId != null && entrantBId != null) {
    const tiersFor = (
      roundsSubset: typeof rounds,
      entrantId: number,
    ): EcoTierSummary => {
      const tiers = emptyEcoTierSummary();
      for (const round of roundsSubset) {
        const spent = spentByRoundEntrant.get(`${round.id}:${entrantId}`) ?? 0;
        const tier = loadoutTierFor(spent);
        if (!tier) continue;
        tiers[tier].total++;
        if (round.winningEntrantId === entrantId) tiers[tier].win++;
      }
      return tiers;
    };
    const roundsByMap = new Map<number, typeof rounds>();
    for (const r of rounds) {
      const list = roundsByMap.get(r.mapId);
      if (list) list.push(r);
      else roundsByMap.set(r.mapId, [r]);
    }
    for (const id of mapIds) {
      const subset = roundsByMap.get(id) ?? [];
      ecoByMapId[id] = {
        teamA: tiersFor(subset, entrantAId),
        teamB: tiersFor(subset, entrantBId),
      };
    }
    aggregatedEco.teamA = tiersFor(rounds, entrantAId);
    aggregatedEco.teamB = tiersFor(rounds, entrantBId);
  }

  return {
    roundsByMapId,
    performanceByMapId,
    ecoByMapId,
    aggregatedPerformance,
    aggregatedEco,
  };
}

export type MatchEncounter = {
  id: number;
  scheduledAt: Date | null;
  tournamentName: string;
  scoreA: number | null;
  scoreB: number | null;
  /** Score/result oriented from the current match's team A perspective, regardless of which side each team was on back then. */
  result: "win" | "loss" | "draw";
};

export async function getMatchEncounters(
  matchId: number,
  teamAId: number | null,
  teamBId: number | null,
  limit = 8,
): Promise<{ teamAWins: number; teamBWins: number; items: MatchEncounter[] }> {
  if (teamAId == null || teamBId == null || teamAId === teamBId)
    return { teamAWins: 0, teamBWins: 0, items: [] };

  const aIds = db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, teamAId));
  const bIds = db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, teamBId));
  const sideAEntrant = alias(entrants, "encounter_side_a");

  const rows = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      sideATeamId: sideAEntrant.teamId,
      tournamentName: tournaments.name,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .leftJoin(sideAEntrant, eq(sideAEntrant.id, matches.entrantAId))
    .where(
      and(
        eq(matches.status, "completed"),
        ne(matches.id, matchId),
        or(
          and(
            inArray(matches.entrantAId, aIds),
            inArray(matches.entrantBId, bIds),
          ),
          and(
            inArray(matches.entrantAId, bIds),
            inArray(matches.entrantBId, aIds),
          ),
        ),
      ),
    )
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);

  let teamAWins = 0;
  let teamBWins = 0;
  const items: MatchEncounter[] = rows.map((r) => {
    const aWasSideA = r.sideATeamId === teamAId;
    const scoreA = aWasSideA ? r.scoreA : r.scoreB;
    const scoreB = aWasSideA ? r.scoreB : r.scoreA;
    let result: MatchEncounter["result"] = "draw";
    if (scoreA != null && scoreB != null) {
      result = scoreA > scoreB ? "win" : scoreA < scoreB ? "loss" : "draw";
      if (result === "win") teamAWins++;
      else if (result === "loss") teamBWins++;
    }
    return {
      id: r.id,
      scheduledAt: r.scheduledAt,
      tournamentName: r.tournamentName,
      scoreA,
      scoreB,
      result,
    };
  });

  return { teamAWins, teamBWins, items };
}

export type HeadToHeadMapRow = {
  mapName: string;
  teamA: { wins: number; timesPlayed: number; winPct: number };
  teamB: { wins: number; timesPlayed: number; winPct: number };
};

/** Optional narrowing shared by the widget builder's link (tournament/date range/explicit map pool) — mirrors V1's HeadToHeadService filters. */
export type HeadToHeadFilters = {
  tournamentId?: number;
  start?: Date;
  end?: Date;
  mapPool?: string[];
};

/**
 * No static "active map pool" table exists — a patch's competitive pool is
 * inferred from what was actually played under it, site-wide (mirrors V1's
 * HeadToHeadService::mapPoolForPatch()). Falls back to an empty list (caller
 * then shows every map) if nothing is recorded for that patch yet.
 */
export async function getMapPoolForPatch(patch: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ mapName: maps.mapName })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .where(
      and(
        eq(matches.patch, patch),
        eq(maps.isCompleted, true),
        isNotNull(maps.mapName),
      ),
    );
  return rows.map((r) => r.mapName!).filter(Boolean);
}

async function teamMapRecords(
  teamId: number,
  filters?: HeadToHeadFilters,
): Promise<Map<string, { wins: number; played: number }>> {
  const entrantIds = db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, teamId));
  const isSideA = inArray(matches.entrantAId, entrantIds);
  const ownScore = sql`case when ${isSideA} then ${maps.teamAScore} else ${maps.teamBScore} end`;
  const oppScore = sql`case when ${isSideA} then ${maps.teamBScore} else ${maps.teamAScore} end`;

  const base = db
    .select({
      mapName: sql<string>`${maps.mapName}`,
      played: sql<number>`count(*)::int`,
      wins: sql<number>`(count(*) filter (where ${ownScore} > ${oppScore}))::int`,
    })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .$dynamic();
  // Stages are only needed for the tournament filter.
  const scoped = filters?.tournamentId
    ? base
        .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
        .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    : base;

  const rows = await scoped
    .where(
      and(
        eq(maps.isCompleted, true),
        isNotNull(maps.mapName),
        isNotNull(maps.teamAScore),
        isNotNull(maps.teamBScore),
        or(isSideA, inArray(matches.entrantBId, entrantIds)),
        filters?.tournamentId
          ? eq(stages.tournamentId, filters.tournamentId)
          : undefined,
        filters?.start && filters?.end
          ? and(
              gte(matches.scheduledAt, filters.start),
              lte(matches.scheduledAt, filters.end),
            )
          : undefined,
      ),
    )
    .groupBy(maps.mapName);

  return new Map(rows.map((r) => [r.mapName, { wins: r.wins, played: r.played }]));
}

/** Each team's own win rate per map (radar chart data), independently computed across all of that team's completed maps — not just meetings between the two. */
export async function getHeadToHeadMapComparison(
  teamAId: number | null,
  teamBId: number | null,
  filters?: HeadToHeadFilters,
): Promise<HeadToHeadMapRow[]> {
  if (teamAId == null || teamBId == null || teamAId === teamBId) return [];

  const [recA, recB] = await Promise.all([
    teamMapRecords(teamAId, filters),
    teamMapRecords(teamBId, filters),
  ]);
  let mapNames = new Set([...recA.keys(), ...recB.keys()]);
  if (filters?.mapPool && filters.mapPool.length > 0) {
    const pool = new Set(filters.mapPool);
    mapNames = new Set([...mapNames].filter((m) => pool.has(m)));
  }

  return Array.from(mapNames)
    .map((mapName) => {
      const a = recA.get(mapName) ?? { wins: 0, played: 0 };
      const b = recB.get(mapName) ?? { wins: 0, played: 0 };
      return {
        mapName,
        teamA: {
          wins: a.wins,
          timesPlayed: a.played,
          winPct:
            a.played > 0 ? Math.round((a.wins / a.played) * 1000) / 10 : 0,
        },
        teamB: {
          wins: b.wins,
          timesPlayed: b.played,
          winPct:
            b.played > 0 ? Math.round((b.wins / b.played) * 1000) / 10 : 0,
        },
      };
    })
    .filter((m) => m.teamA.timesPlayed > 0 || m.teamB.timesPlayed > 0)
    .sort((a, b) => a.mapName.localeCompare(b.mapName));
}

export type MatchStream = {
  id: number;
  name: string;
  platform: string;
  type: string;
  url: string;
  languageCode: string;
};
export type MatchVod = {
  id: number;
  url: string;
  languageCode: string;
  mapOrder: number | null;
  publisherName: string | null;
};

export async function getMatchStreams(matchId: number): Promise<MatchStream[]> {
  const rows = await db
    .select({
      id: streamChannels.id,
      name: streamChannels.name,
      platform: streamChannels.platform,
      type: streamChannels.type,
      url: streamChannels.url,
      languageCode: streamChannels.languageCode,
    })
    .from(matchStreams)
    .innerJoin(
      streamChannels,
      eq(streamChannels.id, matchStreams.streamChannelId),
    )
    .where(
      and(eq(matchStreams.matchId, matchId), eq(streamChannels.isActive, true)),
    );
  // Official streams first, watchparties after
  return rows.sort((a, b) => Number(a.type === "watchparty") - Number(b.type === "watchparty"));
}

export async function getMatchVods(matchId: number): Promise<MatchVod[]> {
  const rows = await db
    .select({
      id: vods.id,
      url: vods.url,
      languageCode: vods.languageCode,
      mapId: vods.mapId,
      organizationId: vods.organizationId,
    })
    .from(vods)
    .where(eq(vods.matchId, matchId));
  if (rows.length === 0) return [];

  const mapIds = rows
    .map((r) => r.mapId)
    .filter((id): id is number => id != null);
  const mapOrders = mapIds.length
    ? await db
        .select({ id: maps.id, order: maps.order })
        .from(maps)
        .where(inArray(maps.id, mapIds))
    : [];
  const orderByMapId = new Map(mapOrders.map((m) => [m.id, m.order]));

  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    languageCode: r.languageCode,
    mapOrder: r.mapId != null ? (orderByMapId.get(r.mapId) ?? null) : null,
    publisherName: null,
  }));
}

export type MatchPlayerPov = {
  id: number;
  entrantId: number;
  handle: string | null;
  twitchLogin: string;
  title: string | null;
  url: string;
};

export async function getMatchPlayerPovs(
  matchId: number,
): Promise<MatchPlayerPov[]> {
  const rows = await db
    .select({
      id: matchPlayerPovs.id,
      entrantId: matchPlayerPovs.entrantId,
      handle: people.handle,
      twitchLogin: matchPlayerPovs.twitchLogin,
      title: matchPlayerPovs.title,
      url: matchPlayerPovs.url,
    })
    .from(matchPlayerPovs)
    .leftJoin(people, eq(people.id, matchPlayerPovs.personId))
    .where(eq(matchPlayerPovs.matchId, matchId));
  return rows;
}

/** Per-player multi-kill breakdown (2k/3k/4k/5k rounds) + Sheriff kills, mirroring V1's MatchStatsService::performanceFor(). Keyed by person id. */
export type MatchPerformance = Record<
  number,
  { sheriffKills: number; k2: number; k3: number; k4: number; k5: number }
>;

export type MatchEcoSummary = { teamA: EcoTierSummary; teamB: EcoTierSummary };

export function emptyMatchEcoSummary(): MatchEcoSummary {
  return { teamA: emptyEcoTierSummary(), teamB: emptyEcoTierSummary() };
}

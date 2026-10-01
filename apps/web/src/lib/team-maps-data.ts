/**
 * GC-Stats - team-maps-data
 *
 * Team page "Maps" tab data: map pool with W/L and ATK/DEF winrate, derived
 * insight cards, and 5-agent compositions with per-map/overall pick rates.
 * Mirrors V1's buildMapsPayload()/buildMapInsights()/buildTeamMapComps().
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { entrants, maps, mapPlayerStats, mapTeamRoundSummary, matches } from "@gc-stats/db";
import type { TournamentMapPickRate } from "@/lib/tournament-maps-data";
import { mapsFilterConditions, type MapsFilters } from "@/lib/maps-filters";

// Shared by the map pool and the comps of the same request.
const getTeamEntrantIds = cache(async (teamId: number): Promise<number[]> => {
  const rows = await db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, teamId));
  return rows.map((r) => r.id);
});

// --- Map pool (times played, W-L record, ATK/DEF winrate) ------------------

export type TeamMapPoolRow = {
  mapName: string;
  timesPlayed: number;
  wins: number;
  losses: number;
  atkWinPct: number | null;
  defWinPct: number | null;
};

/**
 * Every map played by this team (completed only) with its W-L record and
 * ATK/DEF round winrate — mirrors V1's `buildMapsPayload()`. Sorted by times
 * played desc, like the tournament maps page.
 */
export async function getTeamMapPool(teamId: number, filters: MapsFilters): Promise<TeamMapPoolRow[]> {
  const entrantIds = await getTeamEntrantIds(teamId);
  if (entrantIds.length === 0) return [];

  const isEntrantA = inArray(matches.entrantAId, entrantIds);
  const ownScore = sql`coalesce(case when ${isEntrantA} then ${maps.teamAScore} else ${maps.teamBScore} end, 0)`;
  const oppScore = sql`coalesce(case when ${isEntrantA} then ${maps.teamBScore} else ${maps.teamAScore} end, 0)`;

  const [poolRows, sideRows] = await Promise.all([
    db
      .select({
        mapName: sql<string>`${maps.mapName}`,
        timesPlayed: sql<number>`count(*)::int`,
        wins: sql<number>`(count(*) filter (where ${ownScore} > ${oppScore}))::int`,
      })
      .from(maps)
      .innerJoin(matches, eq(matches.id, maps.matchId))
      .where(and(eq(maps.isCompleted, true), isNotNull(maps.mapName), or(isEntrantA, inArray(matches.entrantBId, entrantIds)), ...mapsFilterConditions(filters)))
      .groupBy(maps.mapName)
      .orderBy(desc(sql`count(*)`), maps.mapName),
    db
      .select({
        mapName: maps.mapName,
        side: mapTeamRoundSummary.side,
        roundsPlayed: sql<number>`sum(${mapTeamRoundSummary.roundsPlayed})`,
        roundsWon: sql<number>`sum(${mapTeamRoundSummary.roundsWon})`,
      })
      .from(mapTeamRoundSummary)
      .innerJoin(maps, eq(maps.id, mapTeamRoundSummary.mapId))
      .innerJoin(matches, eq(matches.id, maps.matchId))
      .where(and(eq(maps.isCompleted, true), isNotNull(maps.mapName), inArray(mapTeamRoundSummary.entrantId, entrantIds), ...mapsFilterConditions(filters)))
      .groupBy(maps.mapName, mapTeamRoundSummary.side),
  ]);

  const sidesByMap = new Map<string, { atk?: { played: number; won: number }; def?: { played: number; won: number } }>();
  for (const r of sideRows) {
    if (!r.mapName) continue;
    const entry = sidesByMap.get(r.mapName) ?? {};
    if (r.side === "atk") entry.atk = { played: Number(r.roundsPlayed), won: Number(r.roundsWon) };
    else if (r.side === "def") entry.def = { played: Number(r.roundsPlayed), won: Number(r.roundsWon) };
    sidesByMap.set(r.mapName, entry);
  }

  return poolRows.map(({ mapName, timesPlayed, wins }) => {
    const sides = sidesByMap.get(mapName);
    const atk = sides?.atk;
    const def = sides?.def;
    return {
      mapName,
      timesPlayed,
      wins,
      losses: timesPlayed - wins,
      atkWinPct: atk && atk.played > 0 ? Math.round((atk.won / atk.played) * 1000) / 10 : null,
      defWinPct: def && def.played > 0 ? Math.round((def.won / def.played) * 1000) / 10 : null,
    };
  });
}

export type TeamMapInsight = {
  label: "mostPlayed" | "leastPlayed" | "bestRecord" | "bestWinrate" | "bestAtk" | "bestDef";
  mapName: string | null;
  value: string | null;
};

/** Derives insight cards from the already-computed map pool — no extra query, mirrors V1's `buildMapInsights()`. */
export function buildTeamMapInsights(mapPool: TeamMapPoolRow[]): TeamMapInsight[] {
  if (mapPool.length === 0) return [];

  const insights: TeamMapInsight[] = [];

  const mostPlayed = [...mapPool].sort((a, b) => b.timesPlayed - a.timesPlayed)[0]!;
  insights.push({ label: "mostPlayed", mapName: mostPlayed.mapName, value: String(mostPlayed.timesPlayed) });

  const leastPlayed = [...mapPool].sort((a, b) => a.timesPlayed - b.timesPlayed)[0]!;
  insights.push({ label: "leastPlayed", mapName: leastPlayed.mapName, value: String(leastPlayed.timesPlayed) });

  const bestRecord = [...mapPool].sort((a, b) => b.wins - b.losses - (a.wins - a.losses))[0]!;
  insights.push({ label: "bestRecord", mapName: bestRecord.mapName, value: `${bestRecord.wins}-${bestRecord.losses}` });

  const bestWinrate = [...mapPool].sort((a, b) => {
    const wrA = a.timesPlayed > 0 ? a.wins / a.timesPlayed : -1;
    const wrB = b.timesPlayed > 0 ? b.wins / b.timesPlayed : -1;
    return wrB - wrA;
  })[0]!;
  const bestWinratePct = bestWinrate.timesPlayed > 0 ? Math.round((bestWinrate.wins / bestWinrate.timesPlayed) * 1000) / 10 : null;
  insights.push({ label: "bestWinrate", mapName: bestWinratePct !== null ? bestWinrate.mapName : null, value: bestWinratePct !== null ? `${bestWinratePct}%` : null });

  const withAtk = mapPool.filter((m) => m.atkWinPct != null).sort((a, b) => b.atkWinPct! - a.atkWinPct!)[0];
  insights.push({ label: "bestAtk", mapName: withAtk?.mapName ?? null, value: withAtk ? `${withAtk.atkWinPct}%` : null });

  const withDef = mapPool.filter((m) => m.defWinPct != null).sort((a, b) => b.defWinPct! - a.defWinPct!)[0];
  insights.push({ label: "bestDef", mapName: withDef?.mapName ?? null, value: withDef ? `${withDef.defWinPct}%` : null });

  return insights;
}

// --- Compositions + agent pick rates per map --------------------------------

export type TeamMapCompMatch = { matchId: number; opponent: string; ownScore: number; oppScore: number; won: boolean; scheduledAt: Date | null };

// Matches of a comp are loaded on demand (`getTeamMapCompMatches`), keeps the whole history out of the page payload.
export type TeamMapComp = { agents: string[]; count: number; wins: number; winPct: number | null };

// Agents drafted by one entrant on one map.
const draftedAgents = sql<string[]>`array_agg(distinct ${mapPlayerStats.agentName})`;

/**
 * Groups (map, entrant) rows for this team's own side only into 5-agent
 * compositions — mirrors V1's `buildTeamMapComps()`. A mid-map substitution
 * producing 6+ distinct agents is still counted as one wider comp rather
 * than dropped, same quirk as V1 (kept for parity). Also derives each
 * agent's pick rate per map and across the whole pool.
 */
export async function getTeamMapComps(
  teamId: number,
  filters: MapsFilters,
): Promise<{ compsByMap: Record<string, TeamMapComp[]>; pickRatesByMap: Record<string, TournamentMapPickRate[]>; overallPickRates: TournamentMapPickRate[] }> {
  const entrantIds = await getTeamEntrantIds(teamId);
  if (entrantIds.length === 0) return { compsByMap: {}, pickRatesByMap: {}, overallPickRates: [] };

  const groups = await db
    .select({
      mapName: sql<string>`${maps.mapName}`,
      entrantId: mapPlayerStats.entrantId,
      agents: draftedAgents,
      teamAScore: maps.teamAScore,
      teamBScore: maps.teamBScore,
      entrantAId: matches.entrantAId,
    })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .where(and(eq(maps.isCompleted, true), isNotNull(maps.mapName), isNotNull(mapPlayerStats.agentName), inArray(mapPlayerStats.entrantId, entrantIds), ...mapsFilterConditions(filters)))
    .groupBy(maps.id, mapPlayerStats.entrantId, matches.id);

  const compByKey = new Map<string, { mapName: string; comp: TeamMapComp }>();
  const pickCountsByMap = new Map<string, Map<string, number>>();
  const instancesByMap = new Map<string, number>();
  const overallPickCounts = new Map<string, number>();
  let overallInstances = 0;

  for (const g of groups) {
    const agents = [...g.agents].sort();
    if (agents.length < 5) continue;

    const isEntrantA = g.entrantAId === g.entrantId;
    const ownScore = (isEntrantA ? g.teamAScore : g.teamBScore) ?? 0;
    const oppScore = (isEntrantA ? g.teamBScore : g.teamAScore) ?? 0;

    const key = `${g.mapName}|${agents.join(",")}`;
    let entry = compByKey.get(key);
    if (!entry) {
      entry = { mapName: g.mapName, comp: { agents, count: 0, wins: 0, winPct: null } };
      compByKey.set(key, entry);
    }

    entry.comp.count++;
    if (ownScore > oppScore) entry.comp.wins++;

    instancesByMap.set(g.mapName, (instancesByMap.get(g.mapName) ?? 0) + 1);
    const pickCounts = pickCountsByMap.get(g.mapName) ?? new Map<string, number>();
    for (const agent of agents) pickCounts.set(agent, (pickCounts.get(agent) ?? 0) + 1);
    pickCountsByMap.set(g.mapName, pickCounts);

    overallInstances++;
    for (const agent of agents) overallPickCounts.set(agent, (overallPickCounts.get(agent) ?? 0) + 1);
  }

  const compsByMap: Record<string, TeamMapComp[]> = {};
  for (const { mapName, comp } of compByKey.values()) {
    comp.winPct = comp.count > 0 ? Math.round((comp.wins / comp.count) * 1000) / 10 : null;
    (compsByMap[mapName] ??= []).push(comp);
  }
  for (const list of Object.values(compsByMap)) list.sort((a, b) => b.count - a.count);

  const pickRatesByMap: Record<string, TournamentMapPickRate[]> = {};
  for (const [mapName, pickCounts] of pickCountsByMap) {
    const total = instancesByMap.get(mapName) ?? 0;
    pickRatesByMap[mapName] = [...pickCounts.entries()]
      .map(([agent, count]) => ({ agent, count, pickPct: total > 0 ? Math.round((count / total) * 1000) / 10 : null }))
      .sort((a, b) => (b.pickPct ?? 0) - (a.pickPct ?? 0));
  }

  const overallPickRates: TournamentMapPickRate[] = [...overallPickCounts.entries()]
    .map(([agent, count]) => ({ agent, count, pickPct: overallInstances > 0 ? Math.round((count / overallInstances) * 1000) / 10 : null }))
    .sort((a, b) => (b.pickPct ?? 0) - (a.pickPct ?? 0));

  return { compsByMap, pickRatesByMap, overallPickRates };
}

/** Maps where this team drafted exactly `agents` on `mapName`, most recent first. */
export async function getTeamMapCompMatches(teamId: number, mapName: string, agents: string[], filters: MapsFilters): Promise<TeamMapCompMatch[]> {
  const entrantIds = await getTeamEntrantIds(teamId);
  if (entrantIds.length === 0) return [];

  // Set equality, independent of the agents' order.
  const wanted = sql`array[${sql.join(agents.map((a) => sql`${a}`), sql`, `)}]::text[]`;
  const opponent = alias(entrants, "comp_opponent");
  const rows = await db
    .select({
      entrantId: mapPlayerStats.entrantId,
      teamAScore: maps.teamAScore,
      teamBScore: maps.teamBScore,
      entrantAId: matches.entrantAId,
      matchId: matches.id,
      scheduledAt: matches.scheduledAt,
      opponent: opponent.displayName,
    })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .leftJoin(opponent, eq(opponent.id, sql`case when ${matches.entrantAId} = ${mapPlayerStats.entrantId} then ${matches.entrantBId} else ${matches.entrantAId} end`))
    .where(and(eq(maps.isCompleted, true), eq(maps.mapName, mapName), isNotNull(mapPlayerStats.agentName), inArray(mapPlayerStats.entrantId, entrantIds), ...mapsFilterConditions(filters)))
    .groupBy(maps.id, mapPlayerStats.entrantId, matches.id, opponent.displayName)
    .having(sql`${draftedAgents} @> ${wanted} and ${draftedAgents} <@ ${wanted}`)
    .orderBy(sql`${matches.scheduledAt} desc nulls last`);

  return rows.map((r) => {
    const isEntrantA = r.entrantAId === r.entrantId;
    const ownScore = (isEntrantA ? r.teamAScore : r.teamBScore) ?? 0;
    const oppScore = (isEntrantA ? r.teamBScore : r.teamAScore) ?? 0;
    return { matchId: r.matchId, opponent: r.opponent ?? "?", ownScore, oppScore, won: ownScore > oppScore, scheduledAt: r.scheduledAt };
  });
}

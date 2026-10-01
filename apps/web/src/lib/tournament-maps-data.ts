/**
 * GC-Stats - tournament-maps-data
 *
 * Tournament page "Maps" tab data: map pool with ATK/DEF winrate, derived
 * insight cards, and 5-agent compositions grouped by composition (not by
 * team) with per-team usage breakdown and per-map/overall pick rates.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { entrants, maps, mapPlayerStats, mapTeamRoundSummary, matches, stageContainers, stages } from "@gc-stats/db";
import { getCurrentLogoUrlsThemed } from "@/lib/admin-logos";
import { mapsFilterConditions, type MapsFilters } from "@/lib/maps-filters";

// --- Map pool (times played + ATK/DEF winrate) -----------------------------

export type TournamentMapPoolRow = {
  mapName: string;
  timesPlayed: number;
  atkWinPct: number | null;
  defWinPct: number | null;
};

/**
 * Every map played in this tournament (completed only) with how often it
 * was played and the tournament-wide ATK/DEF round winrate on it — reads
 * `mapTeamRoundSummary` (one row per map/entrant/side), same source V1's
 * `game_player_advanced_stats.atk_rounds(_won)`/`def_rounds(_won)` covered.
 * Sorted by times played desc, like V1's `public/tournament/maps.blade.php`.
 */
export async function getTournamentMapPool(tournamentId: number, filters: MapsFilters): Promise<TournamentMapPoolRow[]> {
  const [playedRows, sideRows] = await Promise.all([
    db
      .select({ mapName: maps.mapName, timesPlayed: sql<number>`count(*)` })
      .from(maps)
      .innerJoin(matches, eq(matches.id, maps.matchId))
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .where(and(eq(stages.tournamentId, tournamentId), eq(maps.isCompleted, true), isNotNull(maps.mapName), ...mapsFilterConditions(filters)))
      .groupBy(maps.mapName),
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
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .where(and(eq(stages.tournamentId, tournamentId), eq(maps.isCompleted, true), isNotNull(maps.mapName), ...mapsFilterConditions(filters)))
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

  return playedRows
    .filter((r): r is { mapName: string; timesPlayed: number } => r.mapName != null)
    .map((r) => {
      const sides = sidesByMap.get(r.mapName);
      const atk = sides?.atk;
      const def = sides?.def;
      return {
        mapName: r.mapName,
        timesPlayed: Number(r.timesPlayed),
        atkWinPct: atk && atk.played > 0 ? Math.round((atk.won / atk.played) * 1000) / 10 : null,
        defWinPct: def && def.played > 0 ? Math.round((def.won / def.played) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.timesPlayed - a.timesPlayed);
}

export type TournamentMapInsight = { label: "mostPlayed" | "leastPlayed" | "bestAtk" | "bestDef"; mapName: string; value: string };

/** Derives "most/least played" / "best ATK/DEF winrate" cards from the already-computed map pool — no extra query, mirrors V1's `buildMapInsights()`. */
export function buildTournamentMapInsights(mapPool: TournamentMapPoolRow[]): TournamentMapInsight[] {
  if (mapPool.length === 0) return [];

  const insights: TournamentMapInsight[] = [];

  const mostPlayed = [...mapPool].sort((a, b) => b.timesPlayed - a.timesPlayed)[0]!;
  insights.push({ label: "mostPlayed", mapName: mostPlayed.mapName, value: String(mostPlayed.timesPlayed) });

  const leastPlayed = [...mapPool].sort((a, b) => a.timesPlayed - b.timesPlayed)[0]!;
  insights.push({ label: "leastPlayed", mapName: leastPlayed.mapName, value: String(leastPlayed.timesPlayed) });

  const withAtk = mapPool.filter((m) => m.atkWinPct != null).sort((a, b) => b.atkWinPct! - a.atkWinPct!)[0];
  if (withAtk) insights.push({ label: "bestAtk", mapName: withAtk.mapName, value: `${withAtk.atkWinPct}%` });

  const withDef = mapPool.filter((m) => m.defWinPct != null).sort((a, b) => b.defWinPct! - a.defWinPct!)[0];
  if (withDef) insights.push({ label: "bestDef", mapName: withDef.mapName, value: `${withDef.defWinPct}%` });

  return insights;
}

// --- Team compositions + agent pick rates per map --------------------------

export type TournamentMapCompTeamUsage = { entrantId: number; teamId: number | null; teamName: string; logoUrl: string | null; logoUrlLight: string | null; count: number; wins: number };

// `entrantId` (not just `matchId`) is what's actually unique here: when both
// teams in one match draft the exact same comp, that single match produces
// two entries (one per side) sharing the same `matchId` — React key must be
// `matchId + entrantId`, not `matchId` alone (caused a duplicate-key warning).
export type TournamentMapCompMatch = { matchId: number; entrantId: number; teamName: string; opponent: string; ownScore: number; oppScore: number; won: boolean; scheduledAt: Date | null };

export type TournamentMapComp = {
  agents: string[];
  count: number;
  wins: number;
  winPct: number | null;
  teams: TournamentMapCompTeamUsage[];
  matches: TournamentMapCompMatch[];
};

export type TournamentMapPickRate = { agent: string; count: number; pickPct: number | null };

/**
 * Groups (map, entrant) rows into 5-agent compositions — grouped by the
 * composition itself (map + agent set), not by team (explicit user request,
 * 2026-09-12: several teams drafting the same comp on a map count as one
 * entry, with a per-team breakdown inside it, rather than one entry per
 * team). A mid-map substitution producing 6+ distinct agents is still
 * counted as one wider comp rather than dropped, same quirk as V1's
 * `buildMapComps()` (kept for parity, not a deliberate design choice). Also
 * derives each agent's pick rate per map (share of team/map drafts that
 * included them).
 */
export async function getTournamentMapComps(
  tournamentId: number,
  filters: MapsFilters,
): Promise<{ compsByMap: Record<string, TournamentMapComp[]>; pickRatesByMap: Record<string, TournamentMapPickRate[]>; overallPickRates: TournamentMapPickRate[] }> {
  // One row per (map, entrant) with the agents it drafted.
  const groups = await db
    .select({
      mapName: sql<string>`${maps.mapName}`,
      entrantId: mapPlayerStats.entrantId,
      agents: sql<string[]>`array_agg(distinct ${mapPlayerStats.agentName})`,
      teamAScore: maps.teamAScore,
      teamBScore: maps.teamBScore,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      matchId: matches.id,
      scheduledAt: matches.scheduledAt,
    })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(eq(stages.tournamentId, tournamentId), eq(maps.isCompleted, true), isNotNull(maps.mapName), isNotNull(mapPlayerStats.agentName), ...mapsFilterConditions(filters)))
    .groupBy(maps.id, mapPlayerStats.entrantId, matches.id);

  const entrantIds = [...new Set(groups.flatMap((g) => [g.entrantId, g.entrantAId, g.entrantBId]).filter((id): id is number => id != null))];
  const entrantRows = entrantIds.length
    ? await db.select({ id: entrants.id, displayName: entrants.displayName, teamId: entrants.teamId }).from(entrants).where(inArray(entrants.id, entrantIds))
    : [];
  const entrantById = new Map(entrantRows.map((e) => [e.id, e]));
  const teamIds = [...new Set(entrantRows.map((e) => e.teamId).filter((id): id is number => id != null))];
  const logosByTeamId = await getCurrentLogoUrlsThemed("team", teamIds);

  // key = mapName|sorted-agents — grouped by composition, not by team: several
  // teams drafting the exact same comp on a map merge into one entry, with a
  // per-team breakdown (`teams`) inside it.
  type CompAcc = { comp: TournamentMapComp; mapName: string; teamUsageByEntrant: Map<number, TournamentMapCompTeamUsage> };
  const compAccByKey = new Map<string, CompAcc>();

  for (const g of groups) {
    const agents = [...g.agents].sort();
    if (agents.length < 5) continue;

    const entrant = entrantById.get(g.entrantId);
    if (!entrant) continue;

    const isEntrantA = g.entrantAId === g.entrantId;
    const ownScore = isEntrantA ? g.teamAScore : g.teamBScore;
    const oppScore = isEntrantA ? g.teamBScore : g.teamAScore;
    const opponentEntrantId = isEntrantA ? g.entrantBId : g.entrantAId;
    const opponent = opponentEntrantId != null ? (entrantById.get(opponentEntrantId)?.displayName ?? "?") : "?";
    const won = (ownScore ?? 0) > (oppScore ?? 0);

    const key = `${g.mapName}|${agents.join(",")}`;
    let acc = compAccByKey.get(key);
    if (!acc) {
      acc = { mapName: g.mapName, comp: { agents, count: 0, wins: 0, winPct: null, teams: [], matches: [] }, teamUsageByEntrant: new Map() };
      compAccByKey.set(key, acc);
    }

    acc.comp.count++;
    if (won) acc.comp.wins++;
    acc.comp.matches.push({
      matchId: g.matchId,
      entrantId: g.entrantId,
      teamName: entrant.displayName,
      opponent,
      ownScore: ownScore ?? 0,
      oppScore: oppScore ?? 0,
      won,
      scheduledAt: g.scheduledAt,
    });

    const usage = acc.teamUsageByEntrant.get(g.entrantId) ?? {
      entrantId: g.entrantId,
      teamId: entrant.teamId,
      teamName: entrant.displayName,
      logoUrl: entrant.teamId != null ? (logosByTeamId.get(entrant.teamId)?.dark ?? null) : null,
      logoUrlLight: entrant.teamId != null ? (logosByTeamId.get(entrant.teamId)?.light ?? null) : null,
      count: 0,
      wins: 0,
    };
    usage.count++;
    if (won) usage.wins++;
    acc.teamUsageByEntrant.set(g.entrantId, usage);
  }

  const compsByMap: Record<string, TournamentMapComp[]> = {};
  const pickCountsByMap = new Map<string, Map<string, number>>();
  const instancesByMap = new Map<string, number>();
  const overallPickCounts = new Map<string, number>();
  let overallInstances = 0;

  for (const { mapName, comp, teamUsageByEntrant } of compAccByKey.values()) {
    comp.winPct = comp.count > 0 ? Math.round((comp.wins / comp.count) * 1000) / 10 : null;
    comp.matches.sort((a, b) => (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0));
    comp.teams = [...teamUsageByEntrant.values()].sort((a, b) => b.count - a.count);
    (compsByMap[mapName] ??= []).push(comp);

    instancesByMap.set(mapName, (instancesByMap.get(mapName) ?? 0) + comp.count);
    const pickCounts = pickCountsByMap.get(mapName) ?? new Map<string, number>();
    for (const agent of comp.agents) pickCounts.set(agent, (pickCounts.get(agent) ?? 0) + comp.count);
    pickCountsByMap.set(mapName, pickCounts);

    overallInstances += comp.count;
    for (const agent of comp.agents) overallPickCounts.set(agent, (overallPickCounts.get(agent) ?? 0) + comp.count);
  }

  for (const list of Object.values(compsByMap)) list.sort((a, b) => b.count - a.count);

  const pickRatesByMap: Record<string, TournamentMapPickRate[]> = {};
  for (const [mapName, pickCounts] of pickCountsByMap) {
    const total = instancesByMap.get(mapName) ?? 0;
    pickRatesByMap[mapName] = [...pickCounts.entries()]
      .map(([agent, count]) => ({ agent, count, pickPct: total > 0 ? Math.round((count / total) * 1000) / 10 : null }))
      .sort((a, b) => (b.pickPct ?? 0) - (a.pickPct ?? 0));
  }

  // Tournament-wide pick rate (every map combined), independent of the map picker below —
  // same "count of drafts including this agent / total drafts" ratio as the per-map ones.
  const overallPickRates: TournamentMapPickRate[] = [...overallPickCounts.entries()]
    .map(([agent, count]) => ({ agent, count, pickPct: overallInstances > 0 ? Math.round((count / overallInstances) * 1000) / 10 : null }))
    .sort((a, b) => (b.pickPct ?? 0) - (a.pickPct ?? 0));

  return { compsByMap, pickRatesByMap, overallPickRates };
}

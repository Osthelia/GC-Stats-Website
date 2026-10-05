/**
 * GC-Stats - admin-matches
 *
 * Admin queries for the tournament bracket/match management pages: match
 * lists and detail, per-match maps, entrant roster, per-map player stats
 * and veto history.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { adminDb as db } from "@gc-stats/db/client";
import { matches, entrants, stageContainers, stages, maps, matchVetos, entrantMembers, people, mapPlayerStats } from "@gc-stats/db";

export type AdminMatchListRow = {
  id: number;
  containerId: number;
  containerName: string;
  stageName: string;
  round: number;
  label: string | null;
  bestOf: number;
  status: "pending" | "live" | "completed";
  entrantAId: number | null;
  entrantAName: string | null;
  entrantBId: number | null;
  entrantBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  scheduledAt: string | null;
  patch: string | null;
};

/** Flat list of every match in a tournament (across all stages/containers) — replaces V1's separate `/admin/tournaments/{t}/matches` page, folded into the bracket management page instead (2026-09-01). */
export async function listTournamentMatches(tournamentId: number): Promise<AdminMatchListRow[]> {
  const entrantA = alias(entrants, "entrant_a");
  const entrantB = alias(entrants, "entrant_b");
  const rows = await db
    .select({ match: matches, containerName: stageContainers.name, stageName: stages.name, entrantAName: entrantA.displayName, entrantBName: entrantB.displayName })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
    .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
    .where(eq(stages.tournamentId, tournamentId))
    .orderBy(asc(matches.containerId), asc(matches.round), asc(matches.id));

  return rows.map(({ match: m, containerName, stageName, entrantAName, entrantBName }) => ({
    id: m.id,
    containerId: m.containerId,
    containerName,
    stageName,
    round: m.round,
    label: m.label,
    bestOf: m.bestOf,
    status: m.status,
    entrantAId: m.entrantAId,
    entrantAName,
    entrantBId: m.entrantBId,
    entrantBName,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
    patch: m.patch,
  }));
}

export type AdminMatchDetail = {
  id: number;
  tournamentId: number;
  containerId: number;
  containerName: string;
  stageId: number;
  stageName: string;
  round: number;
  label: string | null;
  bestOf: number;
  status: "pending" | "live" | "completed";
  entrantAId: number | null;
  entrantBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  scheduledAt: string | null;
  patch: string | null;
  isForfeit: boolean;
};

// Cached per request: generateMetadata and the page both read it.
export const getAdminMatch = cache(async (matchId: number): Promise<AdminMatchDetail | null> => {
  const [row] = await db
    .select({
      id: matches.id,
      containerId: matches.containerId,
      containerName: stageContainers.name,
      stageId: stages.id,
      stageName: stages.name,
      tournamentId: stages.tournamentId,
      round: matches.round,
      label: matches.label,
      bestOf: matches.bestOf,
      status: matches.status,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      winnerId: matches.winnerId,
      scheduledAt: matches.scheduledAt,
      patch: matches.patch,
      isForfeit: matches.isForfeit,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(matches.id, matchId));
  if (!row) return null;
  return { ...row, scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null };
});

export type AdminMapRow = {
  id: number;
  matchId: number;
  apiMatchId: string | null;
  mapName: string | null;
  teamAScore: number | null;
  teamBScore: number | null;
  order: number;
  isCompleted: boolean;
  isForfeit: boolean;
  note: string | null;
};

export async function listMatchMaps(matchId: number): Promise<AdminMapRow[]> {
  return db
    .select({
      id: maps.id,
      matchId: maps.matchId,
      apiMatchId: maps.apiMatchId,
      mapName: maps.mapName,
      teamAScore: maps.teamAScore,
      teamBScore: maps.teamBScore,
      order: maps.order,
      isCompleted: maps.isCompleted,
      isForfeit: maps.isForfeit,
      note: maps.note,
    })
    .from(maps)
    .where(eq(maps.matchId, matchId))
    .orderBy(asc(maps.order), asc(maps.id));
}

/** Single map lookup for the dedicated admin map page (`.../matches/{matchId}/maps/{mapId}`). */
export const getAdminMap = cache(async (mapId: number): Promise<AdminMapRow | null> => {
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
      isForfeit: maps.isForfeit,
      note: maps.note,
    })
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);
  return row ?? null;
});

export type AdminRosterMember = { id: number; handle: string };

/** Locked roster for this tournament entry (`entrant_members`, who played for this team in this tournament) — the player pool for the manual scoreboard form. */
export async function getEntrantRoster(entrantId: number): Promise<AdminRosterMember[]> {
  const rows = await db
    .select({ id: people.id, handle: people.handle })
    .from(entrantMembers)
    .innerJoin(people, eq(people.id, entrantMembers.personId))
    .where(eq(entrantMembers.entrantId, entrantId))
    .orderBy(asc(people.handle));
  return rows;
}

export type AdminMapPlayerStatRow = {
  personId: number | null;
  /** May belong to someone outside this entrant's locked roster (e.g. resolved by Fetch through an already-linked Riot account) — carried so the scoreboard form can still show a name instead of the raw id. */
  handle: string | null;
  entrantId: number;
  agentName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kastPercentage: number;
  firstKills: number;
  firstDeaths: number;
  headshotPercentage: number;
};

/** Existing per-player stats for this map (from a prior Fetch or manual save), used to prefill the manual scoreboard form. */
export async function getAdminMapPlayerStats(mapId: number): Promise<AdminMapPlayerStatRow[]> {
  const rows = await db
    .select({
      personId: mapPlayerStats.personId,
      handle: people.handle,
      entrantId: mapPlayerStats.entrantId,
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
    })
    .from(mapPlayerStats)
    .leftJoin(people, eq(people.id, mapPlayerStats.personId))
    .where(eq(mapPlayerStats.mapId, mapId));
  return rows.map((r) => ({ ...r, kastPercentage: Number(r.kastPercentage), headshotPercentage: Number(r.headshotPercentage) }));
}

export type AdminVetoRow = {
  id: number;
  entrantId: number;
  mapName: string;
  type: "pick" | "ban" | "decider";
  order: number;
  side: "atk" | "def" | null;
  sidePickedByEntrantId: number | null;
};

export async function listMatchVetos(matchId: number): Promise<AdminVetoRow[]> {
  const rows = await db.select().from(matchVetos).where(eq(matchVetos.matchId, matchId)).orderBy(asc(matchVetos.order), asc(matchVetos.id));
  return rows.map((r) => ({
    id: r.id,
    entrantId: r.entrantId,
    mapName: r.mapName,
    type: r.type as "pick" | "ban" | "decider",
    order: r.order,
    side: (r.side as "atk" | "def" | null) ?? null,
    sidePickedByEntrantId: r.sidePickedByEntrantId,
  }));
}

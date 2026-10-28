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
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables, leagueTablesOf, valorantTables, valorantTablesOf } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";
import type { LeagueSide } from "@gc-stats/lol-stats-engine";

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
export async function listTournamentMatches(game: GameSlug, tournamentId: number): Promise<AdminMatchListRow[]> {
  const { matches, entrants, stageContainers, stages } = gameTables(game);
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
export const getAdminMatch = cache(async (game: GameSlug, matchId: number): Promise<AdminMatchDetail | null> => {
  const { matches, stageContainers, stages } = gameTables(game);
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
  const { maps } = valorantTables;
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

export type AdminLeagueGameRow = {
  id: number;
  order: number;
  winnerEntrantId: number | null;
  isCompleted: boolean;
  isForfeit: boolean;
  apiMatchId: string | null;
  note: string | null;
  /** A re-import found champions in the import that the saved draft does not have. */
  draftImportDiffers: boolean;
};

/** The games of a LoL series, in order, for the admin match page. */
export async function listLeagueMatchGames(matchId: number): Promise<AdminLeagueGameRow[]> {
  const { games } = leagueTablesOf("lol");
  return db
    .select({
      id: games.id,
      order: games.order,
      winnerEntrantId: games.winnerEntrantId,
      isCompleted: games.isCompleted,
      isForfeit: games.isForfeit,
      apiMatchId: games.apiMatchId,
      note: games.note,
      draftImportDiffers: games.draftImportDiffers,
    })
    .from(games)
    .where(eq(games.matchId, matchId))
    .orderBy(asc(games.order), asc(games.id));
}

/** Single map lookup for the dedicated admin map page (`.../matches/{matchId}/maps/{mapId}`). */
export const getAdminMap = cache(async (mapId: number): Promise<AdminMapRow | null> => {
  const { maps } = valorantTables;
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
export async function getEntrantRoster(game: GameSlug, entrantId: number): Promise<AdminRosterMember[]> {
  const { entrantMembers, people } = gameTables(game);
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
  /** In game name (Riot ID) as played, filled by Fetch. */
  valName: string | null;
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
export async function getAdminMapPlayerStats(game: GameSlug, mapId: number): Promise<AdminMapPlayerStatRow[]> {
  const { people } = gameTables(game);
  const { mapPlayerStats } = valorantTablesOf(game);
  const rows = await db
    .select({
      personId: mapPlayerStats.personId,
      handle: people.handle,
      entrantId: mapPlayerStats.entrantId,
      agentName: mapPlayerStats.agentName,
      valName: mapPlayerStats.valName,
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
  const { matchVetos } = valorantTables;
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

export interface LeagueDraftView {
  gameId: number;
  order: number;
  imported: boolean;
  draftEditedAt: string | null;
  /** Set by a re-import when the imported champions no longer match the saved draft. */
  draftImportDiffers: boolean;
  blueEntrantId: number | null;
  /** The side with the first pick. Blue by default; it can differ from the blue side. */
  firstPick: LeagueSide;
  /** True when the import set the first pick (the side of Riot's first ban): it cannot be edited by hand. */
  firstPickLocked: boolean;
  steps: { step: number; championName: string }[];
  unplacedPicks: { side: LeagueSide; championName: string }[];
}

/** The draft of a game of the series, or null when the game is not part of it. */
export async function getLeagueGameDraft(matchId: number, gameId: number, entrants: { entrantAId: number | null; entrantBId: number | null }): Promise<LeagueDraftView | null> {
  const { games, gameTeamStats, gameDraft } = leagueTablesOf("lol");
  const [game] = await db
    .select({
      id: games.id,
      order: games.order,
      source: games.source,
      draftEditedAt: games.draftEditedAt,
      draftImportDiffers: games.draftImportDiffers,
      draftFirstPick: games.draftFirstPick,
    })
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.matchId, matchId)))
    .limit(1);
  if (!game) return null;

  const rows = await db
    .select({ entrantId: gameDraft.entrantId, type: gameDraft.type, championName: gameDraft.championName, order: gameDraft.order })
    .from(gameDraft)
    .where(eq(gameDraft.gameId, gameId));

  // An import's blue side is Riot's blue team. By hand, step 1 is the first ban, made by the first-pick side, so blue
  // is that entrant when blue has the first pick, else the other one. Without a saved draft it is entrant A.
  const firstPick: LeagueSide = game.draftFirstPick === "red" ? "red" : "blue";
  let blueEntrantId: number | null = null;
  if (game.source !== null) {
    const [blueTeam] = await db
      .select({ entrantId: gameTeamStats.entrantId })
      .from(gameTeamStats)
      .where(and(eq(gameTeamStats.gameId, gameId), eq(gameTeamStats.side, "blue")))
      .limit(1);
    blueEntrantId = blueTeam?.entrantId ?? null;
  }
  if (blueEntrantId === null) {
    const firstPickEntrantId = rows.find((row) => row.order === 1)?.entrantId;
    const otherEntrantId = firstPickEntrantId === entrants.entrantAId ? entrants.entrantBId : entrants.entrantAId;
    blueEntrantId = firstPickEntrantId === undefined ? entrants.entrantAId : firstPick === "blue" ? firstPickEntrantId : otherEntrantId;
  }
  const sideOf = (entrantId: number): LeagueSide => (entrantId === blueEntrantId ? "blue" : "red");

  return {
    gameId: game.id,
    order: game.order,
    imported: game.source !== null,
    draftEditedAt: game.draftEditedAt?.toISOString() ?? null,
    draftImportDiffers: game.draftImportDiffers,
    blueEntrantId,
    firstPick,
    firstPickLocked: game.source !== null && game.draftFirstPick !== null,
    steps: rows.flatMap((row) => (row.order === null ? [] : [{ step: row.order, championName: row.championName }])),
    unplacedPicks: rows.flatMap((row) => (row.order === null && row.type === "pick" ? [{ side: sideOf(row.entrantId), championName: row.championName }] : [])),
  };
}

/**
 * GC-Stats — lol game-summary module
 *
 * Pure mapping from one Match-V5 match to the summary rows of a LoL game:
 * the game row, player stats, team stats and draft. No database access; the
 * caller supplies the ids that the database assigns (game, entrants, people).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { championNameOf } from "./champion-catalog";
import type { RiotMatchDto, RiotParticipantDto, RiotTeamDto, RiotTeamId } from "./types";

export type LeagueSide = "blue" | "red";

export interface LeagueGameRow {
  order: number;
  apiMatchId: string;
  platformId: string;
  startedAt: Date;
  durationSeconds: number;
  winnerEntrantId: number | null;
  isCompleted: true;
  isForfeit: false;
}

export interface LeaguePlayerStatsRow {
  gameId: number;
  entrantId: number;
  personId: number | null;
  championName: string;
  role: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage: number;
  vision: number;
  items: number[];
  /** The whole rune page: both trees with every selected rune, in order, and the stat shards. */
  runes: { primaryStyle: number; primaryPerks: number[]; subStyle: number; subPerks: number[]; statPerks: { offense: number; flex: number; defense: number } | null };
  /** The two summoner spell ids (Flash, Ignite...), in the order the player took them. */
  summoners: number[];
}

export interface LeagueTeamStatsRow {
  gameId: number;
  entrantId: number;
  side: LeagueSide;
  kills: number;
  towers: number;
  inhibitors: number;
  dragons: number;
  barons: number;
  heralds: number;
  grubs: number;
  gold: number;
  objectives: Record<string, { kills: number; first: boolean }>;
}

export interface LeagueDraftRow {
  gameId: number;
  entrantId: number;
  championName: string;
  type: "pick" | "ban";
  order: number | null;
}

export interface LeagueGameSummary {
  game: LeagueGameRow;
  players: LeaguePlayerStatsRow[];
  teams: LeagueTeamStatsRow[];
  draft: LeagueDraftRow[];
}

export interface LeagueSummaryContext {
  /** Game row id, already inserted by the store. */
  gameId: number;
  /** Game of the series this Riot game is (1-based). */
  order: number;
  /** Entrant id for each side, from the import's team choice. */
  entrantIdBySide: Record<LeagueSide, number>;
  /** Person id for each puuid; a missing puuid maps to null. */
  personIdByPuuid: Map<string, number>;
  /** Champion display name for a championId, e.g. 103 → "Ahri". Must name every champion of the game (see missingChampionIds). */
  championNameById: Map<number, string>;
  /** The role of each participant, from resolvePlayerRoles. Without it the role is Riot's teamPosition. */
  roleByParticipantId?: Map<number, string | null>;
}

const SIDE_BY_TEAM_ID: Record<RiotTeamId, LeagueSide> = { 100: "blue", 200: "red" };
const LANE_ROLES = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

/** A lane role from Riot's teamPosition. Anything else (empty, "AFK", "Invalid") is null, so it never pairs with a lane opponent. */
export function roleOf(teamPosition: string): string | null {
  return LANE_ROLES.has(teamPosition) ? teamPosition : null;
}

/** The role the stats use: the resolved one when the caller gave it (inference, admin override), else Riot's teamPosition. */
function playerRole(p: RiotParticipantDto, ctx: LeagueSummaryContext): string | null {
  return ctx.roleByParticipantId?.has(p.participantId) ? ctx.roleByParticipantId.get(p.participantId)! : roleOf(p.teamPosition);
}

/** Riot's `teamId`: 100 is blue, 200 is red. Games entered by hand have no side. */
export function sideForTeamId(teamId: RiotTeamId): LeagueSide {
  return SIDE_BY_TEAM_ID[teamId];
}

export function buildGameSummary(match: RiotMatchDto, ctx: LeagueSummaryContext): LeagueGameSummary {
  const { info } = match;
  const winningTeam = info.teams.find((team) => team.win);

  const game: LeagueGameRow = {
    order: ctx.order,
    apiMatchId: match.metadata.matchId,
    platformId: info.platformId,
    startedAt: new Date(info.gameCreation),
    durationSeconds: info.gameDuration,
    winnerEntrantId: winningTeam ? ctx.entrantIdBySide[sideForTeamId(winningTeam.teamId)] : null,
    isCompleted: true,
    // Riot's surrender votes are real games, not forfeits. Forfeits come from manual entry only.
    isForfeit: false,
  };

  const players = info.participants.map((p) => buildPlayerRow(p, ctx));
  const teams = info.teams.map((team) => buildTeamRow(team, info.participants, ctx));
  const draft = info.teams.flatMap((team) => buildBanRows(team, ctx));
  // Picks come from the participants: Match-V5 gives no pick order.
  draft.push(...info.participants.map((p) => buildPickRow(p, ctx)));

  return { game, players, teams, draft };
}

function buildPlayerRow(p: RiotParticipantDto, ctx: LeagueSummaryContext): LeaguePlayerStatsRow {
  const side = sideForTeamId(p.teamId);
  const primary = p.perks.styles[0];
  const secondary = p.perks.styles[1];
  return {
    gameId: ctx.gameId,
    entrantId: ctx.entrantIdBySide[side],
    personId: ctx.personIdByPuuid.get(p.puuid) ?? null,
    championName: championNameOf(ctx.championNameById, p.championId),
    role: playerRole(p, ctx),
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    gold: p.goldEarned,
    damage: p.totalDamageDealtToChampions,
    vision: p.visionScore,
    // Slot order, empty slots dropped.
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter((id) => id !== 0),
    runes: {
      primaryStyle: primary?.style ?? 0,
      primaryPerks: primary?.selections.map((s) => s.perk) ?? [],
      subStyle: secondary?.style ?? 0,
      subPerks: secondary?.selections.map((s) => s.perk) ?? [],
      statPerks: p.perks.statPerks ?? null,
    },
    summoners: [p.spell1Id, p.spell2Id],
  };
}

function buildTeamRow(team: RiotTeamDto, participants: RiotParticipantDto[], ctx: LeagueSummaryContext): LeagueTeamStatsRow {
  const side = sideForTeamId(team.teamId);
  const own = participants.filter((p) => p.teamId === team.teamId);
  const objectives = Object.fromEntries(
    Object.entries(team.objectives)
      .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== undefined)
      .map(([name, o]) => [name, { kills: o.kills, first: o.first }]),
  );
  return {
    gameId: ctx.gameId,
    entrantId: ctx.entrantIdBySide[side],
    side,
    kills: own.reduce((sum, p) => sum + p.kills, 0),
    towers: team.objectives.tower.kills,
    inhibitors: team.objectives.inhibitor.kills,
    dragons: team.objectives.dragon.kills,
    barons: team.objectives.baron.kills,
    heralds: team.objectives.riftHerald.kills,
    grubs: team.objectives.horde.kills,
    gold: own.reduce((sum, p) => sum + p.goldEarned, 0),
    objectives,
  };
}

function buildBanRows(team: RiotTeamDto, ctx: LeagueSummaryContext): LeagueDraftRow[] {
  const side = sideForTeamId(team.teamId);
  return team.bans
    .filter((ban) => ban.championId > 0) // Riot uses -1 for an empty ban slot
    .map((ban) => ({
      gameId: ctx.gameId,
      entrantId: ctx.entrantIdBySide[side],
      championName: championNameOf(ctx.championNameById, ban.championId),
      type: "ban" as const,
      order: ban.pickTurn,
    }));
}

function buildPickRow(p: RiotParticipantDto, ctx: LeagueSummaryContext): LeagueDraftRow {
  return {
    gameId: ctx.gameId,
    entrantId: ctx.entrantIdBySide[sideForTeamId(p.teamId)],
    championName: championNameOf(ctx.championNameById, p.championId),
    type: "pick",
    order: null,
  };
}

/**
 * GC-Stats - stats-aggregate
 *
 * Shape of one aggregated stats row (per agent on the player stats page,
 * per person on the tournament stats page), the V2 equivalent of V1's
 * precomputed total_x/avg_x column pairs. Computed by
 * `aggregateMapPlayerStatsSql`. Type only, safe to import client side.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** The sums over the maps of one group. */
export type ValorantTotals = {
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kastPercentage: number;
  firstKills: number;
  firstDeaths: number;
  headshotPercentage: number;
  tradeKills: number;
  tradedDeaths: number;
  fallDeaths: number;
  ability1Kills: number;
  ability2Kills: number;
  grenadeKills: number;
  ultimateKills: number;
  multi2k: number;
  multi3k: number;
  multi4k: number;
  multi5k: number;
  clutchesWon: number;
  clutchesPlayed: number;
};

/** The sums over the games of one group. */
export type LeagueTotals = {
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  /** The kills of the player's team in the same games, for the kill participation. */
  teamKills: number;
  cs: number;
  gold: number;
  damage: number;
  vision: number;
  /** The length of the games played, in minutes, for the per minute stats. */
  minutes: number;
};

export type LeagueAverages = {
  goldDiff10: number;
  goldDiff15: number;
  xpDiff10: number;
  xpDiff15: number;
  csDiff10: number;
  csDiff15: number;
};

type StatRowOf<Totals> = {
  /** agentName (player stats page) or String(personId) (team stats page) */
  groupKey: string;
  /** The maps (Valorant) or games (LoL) played. */
  mapsPlayed: number;
  totals: Totals;
};

export type StatRow = StatRowOf<ValorantTotals> & {
  roundsPlayed: number;
  weaponKills: Record<string, number>;
};

export type LeagueStatRow = StatRowOf<LeagueTotals> & { averages: LeagueAverages };

/** The champions table of the LoL tournament page */
export type { ChampionStatRow } from "@gc-stats/lol-stats-engine";

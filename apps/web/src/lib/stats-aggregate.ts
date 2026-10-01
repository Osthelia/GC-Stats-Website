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

export type StatRow = {
  /** agentName (player stats page) or String(personId) (team stats page) */
  groupKey: string;
  mapsPlayed: number;
  totals: {
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
  weaponKills: Record<string, number>;
};

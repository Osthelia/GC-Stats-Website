/**
 * GC-Stats — champion-stats module
 *
 * What a tournament's games say about each champion: picks, bans, presence, win rate and the average line, and the
 * highlights of the champions page. Pure, no database access.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sortLanes } from "./lanes";
import { kdaRatio } from "./series-stats";

export interface ChampionPickRow {
  championName: string;
  picks: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  roles: string[];
}

export interface ChampionBanRow {
  championName: string;
  bans: number;
}

export interface ChampionStatRow {
  /** The champion's name. */
  groupKey: string;
  mapsPlayed: number;
  totals: {
    games: number;
    picks: number;
    bans: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
  };
  roles: string[];
}

/** The fewest picks a champion needs to be named the best win rate or KDA: one lucky pick would win them otherwise. */
export const MIN_PICKS_FOR_RATES = 3;

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** Percent of the games the champion was picked or banned in. */
export function championPresence(picks: number, bans: number, games: number): number {
  return ratio(picks + bans, games) * 100;
}

export function championWinRate(wins: number, picks: number): number {
  return ratio(wins, picks) * 100;
}

/** A champion that was only banned has no pick row, so it comes from the bans with zero picks. */
export function buildChampionStatRows(pickRows: ChampionPickRow[], banRows: ChampionBanRow[], games: number): ChampionStatRow[] {
  const rows = new Map<string, ChampionStatRow>();
  const rowOf = (championName: string) => {
    let row = rows.get(championName);
    if (!row) {
      row = { groupKey: championName, mapsPlayed: 0, totals: { games, picks: 0, bans: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }, roles: [] };
      rows.set(championName, row);
    }
    return row;
  };

  for (const p of pickRows) {
    const row = rowOf(p.championName);
    row.mapsPlayed = p.picks;
    Object.assign(row.totals, { picks: p.picks, wins: p.wins, kills: p.kills, deaths: p.deaths, assists: p.assists });
    // Lane order. Roles can only be these five (overrides are validated, nulls are left out by the query).
    row.roles = sortLanes(p.roles);
  }
  for (const b of banRows) rowOf(b.championName).totals.bans = b.bans;

  return [...rows.values()];
}

export type ChampionInsightLabel = "mostPicked" | "mostBanned" | "highestPresence" | "highestWinRate" | "highestKda";

export interface ChampionInsight {
  label: ChampionInsightLabel;
  /** Every champion that leads, by name: several when they tie. */
  championNames: string[];
  value: string;
}

/** The champions with the highest `score`, by name. */
function leaders(rows: ChampionStatRow[], score: (row: ChampionStatRow) => number, shown: (row: ChampionStatRow) => string): ChampionStatRow[] {
  const scored = rows.filter((row) => score(row) > 0);
  if (scored.length === 0) return [];
  const top = scored.reduce((a, b) => (score(b) > score(a) ? b : a));
  const topValue = shown(top);
  return scored.filter((row) => shown(row) === topValue).sort((a, b) => (a.groupKey < b.groupKey ? -1 : 1));
}

/** Most picked, most banned, highest presence, best win rate and best KDA (both need `minPicks` picks). A highlight nobody earns is left out. */
export function buildChampionInsights(rows: ChampionStatRow[], minPicks = MIN_PICKS_FOR_RATES): ChampionInsight[] {
  const insights: ChampionInsight[] = [];
  const add = (label: ChampionInsightLabel, candidates: ChampionStatRow[], score: (row: ChampionStatRow) => number, shown: (row: ChampionStatRow) => string) => {
    const top = leaders(candidates, score, shown);
    if (top.length > 0) insights.push({ label, championNames: top.map((row) => row.groupKey), value: shown(top[0]!) });
  };
  const presence = (r: ChampionStatRow) => championPresence(r.totals.picks, r.totals.bans, r.totals.games);
  const winRate = (r: ChampionStatRow) => championWinRate(r.totals.wins, r.totals.picks);
  const kda = (r: ChampionStatRow) => kdaRatio(r.totals.kills, r.totals.deaths, r.totals.assists);
  const pickedEnough = rows.filter((r) => r.totals.picks >= minPicks);

  add("mostPicked", rows, (r) => r.totals.picks, (r) => String(r.totals.picks));
  add("mostBanned", rows, (r) => r.totals.bans, (r) => String(r.totals.bans));
  add("highestPresence", rows, presence, (r) => `${presence(r).toFixed(1)}%`);
  add("highestWinRate", pickedEnough, winRate, (r) => `${winRate(r).toFixed(1)}%`);
  add("highestKda", pickedEnough, kda, (r) => kda(r).toFixed(2));
  return insights;
}

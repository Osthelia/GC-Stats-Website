/**
 * GC-Stats — Standings types
 *
 * Shared standings data shapes and the generic rank assignment helper used
 * by both the round-robin and Swiss standings calculators.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export interface StandingsEntry {
  id: string;
  seed: number;
  wins: number;
  losses: number;
  buchholz: number; // hundredths
  roundDiff: number;
  headToHead?: Map<string, "win" | "loss">; // opponentId -> result, round-robin only
  /** Optional configurable points tally (match/map/round win, forfeit win —
   *  the actual point VALUES are a caller concern, this is just a generic
   *  sortable score) — omitted (treated as 0) when a container has no
   *  points-based tiebreaker configured. */
  points?: number;
}

export interface RankedStandingsEntry extends StandingsEntry {
  rank: number;
}

export interface StandingsCalculator {
  /** Returns entries sorted best-to-worst, with `rank` assigned (ties share a rank). */
  recompute(entries: StandingsEntry[]): RankedStandingsEntry[];
}

/** Assigns ranks from an already best-to-worst sorted list, giving equal
 *  rank to entries the comparator considers tied (standard competition
 *  ranking: 1,2,2,4 — not 1,2,2,3). */
export function assignRanks<T>(sorted: T[], isTied: (a: T, b: T) => boolean): (T & { rank: number })[] {
  const result: (T & { rank: number })[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const rank = i > 0 && isTied(sorted[i - 1]!, sorted[i]!) ? result[i - 1]!.rank : i + 1;
    result.push({ ...sorted[i]!, rank });
  }
  return result;
}

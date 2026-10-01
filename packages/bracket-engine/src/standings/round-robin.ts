/**
 * GC-Stats — Round-robin standings calculator
 *
 * Ranks entries by wins, then a configurable tiebreaker chain (points,
 * round diff, head to head, seed).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { StandingsCalculator, StandingsEntry, RankedStandingsEntry } from "./types";
import { assignRanks } from "./types";

export type RoundRobinTiebreaker = "points" | "round_diff" | "head_to_head" | "seed";

export interface RoundRobinStandingsConfig {
  tiebreakers: RoundRobinTiebreaker[];
}

/** Wins first, then the configured tiebreaker chain (round diff, then a
 *  single-opponent head-to-head lookup, then seed as a final stable break). */
export function createRoundRobinStandings(config: RoundRobinStandingsConfig): StandingsCalculator {
  return {
    recompute(entries: StandingsEntry[]): RankedStandingsEntry[] {
      const sorted = [...entries].sort((a, b) => compare(a, b, config.tiebreakers));
      return assignRanks(sorted, (a, b) => compare(a, b, config.tiebreakers) === 0);
    },
  };
}

function compare(a: StandingsEntry, b: StandingsEntry, tiebreakers: RoundRobinTiebreaker[]): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  for (const tb of tiebreakers) {
    if (tb === "points" && (a.points ?? 0) !== (b.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
    if (tb === "round_diff" && a.roundDiff !== b.roundDiff) return b.roundDiff - a.roundDiff;
    if (tb === "head_to_head") {
      // Pairwise only: on a 3+ way circular tie (A > B > C > A) the result is
      // arbitrary but deterministic (sort order dependent), not incorrect.
      const result = a.headToHead?.get(b.id);
      if (result === "win") return -1;
      if (result === "loss") return 1;
    }
    if (tb === "seed" && a.seed !== b.seed) return a.seed - b.seed;
  }
  return a.seed - b.seed;
}

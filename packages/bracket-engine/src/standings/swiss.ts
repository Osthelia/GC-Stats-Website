/**
 * GC-Stats — swiss module
 *
 * Ranks entries by wins, then a configurable tiebreaker chain (points,
 * Buchholz, round diff, seed), matching the pairing engine's own ordering.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { StandingsCalculator, StandingsEntry, RankedStandingsEntry } from "./types";
import { assignRanks } from "./types";

export type SwissStandingsTiebreaker = "points" | "buchholz" | "round_diff" | "seed";

export interface SwissStandingsConfig {
  tiebreakers: SwissStandingsTiebreaker[];
}

/** Wins first, then Buchholz (or whatever tiebreaker chain the container's
 *  `container_standings_rules` configures), matching the same ordering the
 *  pairing engine itself uses to sort score groups. */
export function createSwissStandings(config: SwissStandingsConfig): StandingsCalculator {
  return {
    recompute(entries: StandingsEntry[]): RankedStandingsEntry[] {
      const sorted = [...entries].sort((a, b) => compare(a, b, config.tiebreakers));
      return assignRanks(sorted, (a, b) => compare(a, b, config.tiebreakers) === 0);
    },
  };
}

function compare(a: StandingsEntry, b: StandingsEntry, tiebreakers: SwissStandingsTiebreaker[]): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  for (const tb of tiebreakers) {
    if (tb === "points" && (a.points ?? 0) !== (b.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
    if (tb === "buchholz" && a.buchholz !== b.buchholz) return b.buchholz - a.buchholz;
    if (tb === "round_diff" && a.roundDiff !== b.roundDiff) return b.roundDiff - a.roundDiff;
    if (tb === "seed" && a.seed !== b.seed) return a.seed - b.seed;
  }
  return a.seed - b.seed;
}

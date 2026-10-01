/**
 * GC-Stats — Single elimination bracket generator
 *
 * Builds a mathematically correct single elimination bracket for any
 * entrant count >= 2, padding to the next power of two with byes so every
 * round after round 1 needs no special casing.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { BracketGraph, MatchNode, BracketEdge } from "../graph/types";
import { buildStandardSeedOrder, nextPowerOfTwo } from "../graph/seed-order";

export interface SingleEliminationOptions {
  containerId: string;
  entrantCount: number;
  bestOf?: number;
}

/**
 * Generates a mathematically correct single elimination bracket for ANY
 * number of entrants >= 2 (not just powers of two).
 *
 * Principle: the bracket is always built at size bracketSize =
 * nextPowerOfTwo(entrantCount). Every round-1 position is a match, even when
 * one side has no real entrant (bye) — no special case in later rounds, the
 * winner of a "bye" match advances via a normal edge, exactly like a played
 * match.
 *
 * Real seeds (seed -> entrantId mapping) are resolved later (out of scope
 * for this generator, which only knows seed numbers).
 */
export function generateSingleElimination(options: SingleEliminationOptions): BracketGraph {
  const { containerId, entrantCount, bestOf = 1 } = options;
  if (entrantCount < 2) {
    throw new Error(`generateSingleElimination: entrantCount must be >= 2, got ${entrantCount}`);
  }

  const bracketSize = nextPowerOfTwo(entrantCount);
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = buildStandardSeedOrder(bracketSize);

  const matches: MatchNode[] = [];
  const edges: BracketEdge[] = [];

  // round -> list of matchIds for that round, in bracket position order
  const matchIdsByRound: string[][] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const numMatches = bracketSize / 2 ** round;
    const roundMatchIds: string[] = [];

    for (let i = 0; i < numMatches; i++) {
      const matchId = `${containerId}-R${round}-M${i + 1}`;
      roundMatchIds.push(matchId);

      const match: MatchNode = {
        id: matchId,
        containerId,
        round,
        bestOf,
        status: "pending",
        seeds: [],
      };

      if (round === 1) {
        const seedA = seedOrder[2 * i];
        const seedB = seedOrder[2 * i + 1];
        if (seedA === undefined || seedB === undefined) {
          throw new Error(`generateSingleElimination: invalid seed order at position ${i}`);
        }
        match.seeds.push({
          slot: "a",
          source: seedA <= entrantCount ? { type: "seed", seed: seedA } : { type: "bye" },
        });
        match.seeds.push({
          slot: "b",
          source: seedB <= entrantCount ? { type: "seed", seed: seedB } : { type: "bye" },
        });
      }

      matches.push(match);
    }

    matchIdsByRound.push(roundMatchIds);
  }

  // Winner-only edges between consecutive rounds: match i of round r-1
  // feeds match floor(i/2) of round r, into slot a if i is even, b otherwise.
  for (let round = 2; round <= totalRounds; round++) {
    const previousRoundIds = matchIdsByRound[round - 2]!;
    const currentRoundIds = matchIdsByRound[round - 1]!;
    for (let i = 0; i < previousRoundIds.length; i++) {
      const fromMatchId = previousRoundIds[i]!;
      const toMatchId = currentRoundIds[Math.floor(i / 2)]!;
      edges.push({
        fromMatchId,
        fromResult: "winner",
        toMatchId,
        toSlot: i % 2 === 0 ? "a" : "b",
      });
    }
  }

  return { matches, edges };
}

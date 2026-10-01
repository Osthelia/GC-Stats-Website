/**
 * GC-Stats — Round-robin bracket generator
 *
 * Generates a round robin (single or double) using the standard circle
 * method. No bracketEdges: every match's slots are fixed at creation.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { BracketGraph, MatchNode } from "../graph/types";

export interface RoundRobinOptions {
  containerId: string;
  entrantCount: number;
  bestOf?: number;
  /** Play every pairing twice (home/away style), doubling the match count. */
  double?: boolean;
}

/**
 * Generates a round robin: every entrant plays every other entrant exactly
 * once (or twice if `double`). No `bracketEdges` — every match's slots are
 * fixed at creation via `seeds` (`{type:"seed", seed:n}`), there is no
 * downstream propagation to compute.
 *
 * Uses the standard "circle method": entrant 1 stays fixed, the rest rotate
 * around it each round. An odd entrant count gets a virtual "bye" seed
 * added so the algorithm always pairs an even number of slots — the entrant
 * paired against the bye sits out that round (no match node is created for
 * that pairing, so byes never show up as matches to play).
 */
export function generateRoundRobin(options: RoundRobinOptions): BracketGraph {
  const { containerId, entrantCount, bestOf = 1, double = false } = options;
  if (entrantCount < 2) {
    throw new Error(`generateRoundRobin: entrantCount must be >= 2, got ${entrantCount}`);
  }

  const BYE = 0; // sentinel seed number, never a real entrant (seeds are 1-based)
  const hasBye = entrantCount % 2 === 1;
  const slotCount = hasBye ? entrantCount + 1 : entrantCount;
  const roundsPerLeg = slotCount - 1;

  // seeds[0] is fixed, the rest rotate.
  let rotating = Array.from({ length: slotCount - 1 }, (_, i) => (i + 2 <= entrantCount ? i + 2 : BYE));
  const fixed = 1;

  const matches: MatchNode[] = [];
  let matchCounter = 0;

  function playLeg(legIndex: number, swapSides: boolean) {
    let current = [...rotating];
    for (let round = 1; round <= roundsPerLeg; round++) {
      const roundSeeds = [fixed, ...current];
      const half = slotCount / 2;
      for (let i = 0; i < half; i++) {
        const s1 = roundSeeds[i]!;
        const s2 = roundSeeds[slotCount - 1 - i]!;
        if (s1 === BYE || s2 === BYE) continue; // this entrant sits out

        matchCounter++;
        const seedA = swapSides ? s2 : s1;
        const seedB = swapSides ? s1 : s2;
        matches.push({
          id: `${containerId}-L${legIndex}-R${round}-M${matchCounter}`,
          containerId,
          round: legIndex === 0 ? round : roundsPerLeg + round,
          bestOf,
          status: "pending",
          seeds: [
            { slot: "a", source: { type: "seed", seed: seedA } },
            { slot: "b", source: { type: "seed", seed: seedB } },
          ],
        });
      }

      // Rotate: last element moves to front of the rotating part.
      const last = current[current.length - 1]!;
      current = [last, ...current.slice(0, -1)];
    }
  }

  playLeg(0, false);
  if (double) {
    matchCounter = 0;
    playLeg(1, true);
  }

  return { matches, edges: [] };
}

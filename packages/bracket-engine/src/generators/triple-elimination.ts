/**
 * GC-Stats — Triple elimination bracket generator
 *
 * Builds a 3-lives bracket: upper (single elimination), middle (upper's
 * losers) and lower (middle's losers), reusing the shared drop cascade
 * twice, joined by a 2-match finals sequence with no reset match.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { BracketGraph, MatchNode, BracketEdge } from "../graph/types";
import { isByeMatch } from "../graph/types";
import { generateSingleElimination } from "./single-elimination";
import { nextPowerOfTwo } from "../graph/seed-order";
import { runDropCascade, type Feeder, type CascadeRunner } from "./cascade";

export interface TripleEliminationOptions {
  upperContainerId: string;
  middleContainerId: string;
  lowerContainerId: string;
  /** Container that holds the 2-match finals sequence (Final 1 / Final 2). */
  grandFinalContainerId: string;
  entrantCount: number;
  bestOf?: number;
  grandFinalBestOf?: number;
}

/**
 * Generates a triple elimination bracket: 3 lives per entrant. Upper
 * bracket (0 losses) is a plain single elimination; its losers drop into
 * the Middle bracket (1 loss); Middle bracket losers drop into the Lower
 * bracket (2 losses); a Lower bracket loss eliminates (3rd loss).
 *
 * Not a standard, universally-defined format the way single/double
 * elimination are (there's no one textbook triple-elim shape) — this is
 * the real case that originally motivated modeling brackets as a generic
 * graph rather than hardcoded formats (see bracket-engine-spec-v2.md's
 * gc-stats.app/tournaments/236 reference, a hand-built 3-bracket
 * Upper/Middle/Lower playoff). This generator gives it a well-defined,
 * fully tested shape for the common case; genuinely bespoke cross-bracket
 * wiring (custom seeding between tiers, etc.) still goes through the
 * visual editor on top of this as a starting point, same as every other
 * generator.
 *
 * Reuses the exact same drop-cascade construction as double elimination
 * (`runDropCascade`, cf. `cascade.ts`) twice in a row: once to build the
 * Middle bracket from the Upper bracket's losers, and once more to build
 * the Lower bracket from the Middle bracket's OWN losers — the cascade
 * doesn't care where its input losers came from, only that they're grouped
 * round-by-round the same way.
 *
 * Finals: two matches, winner takes the tournament outright — Final 1
 * (Upper champion vs Middle champion), Final 2 (Final 1's winner vs Lower
 * champion). No reset match (2026-08-31, explicit user decision: not a
 * concept this project uses, mirrors the same call on double elimination).
 */
export function generateTripleElimination(options: TripleEliminationOptions): BracketGraph {
  const {
    upperContainerId,
    middleContainerId,
    lowerContainerId,
    grandFinalContainerId,
    entrantCount,
    bestOf = 1,
    grandFinalBestOf = bestOf,
  } = options;

  if (entrantCount < 3) {
    throw new Error(
      `generateTripleElimination: entrantCount must be >= 3 (triple elimination needs room for a 2nd loss before the finals), got ${entrantCount}`
    );
  }

  const upper = generateSingleElimination({ containerId: upperContainerId, entrantCount, bestOf });
  const bracketSize = nextPowerOfTwo(entrantCount);
  const totalUpperRounds = Math.log2(bracketSize);

  const upperLoserFeeders: Feeder[][] = [];
  for (let round = 1; round <= totalUpperRounds; round++) {
    const roundMatches = upper.matches
      .filter((m) => m.round === round)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    upperLoserFeeders.push(
      roundMatches.map((m) => (isByeMatch(m) ? null : { matchId: m.id, result: "loser" as const }))
    );
  }

  const upperFinal = upper.matches.find((m) => m.round === totalUpperRounds);
  if (!upperFinal) throw new Error("generateTripleElimination: upper bracket final not found");
  const upperChampion: Feeder = { matchId: upperFinal.id, result: "winner" };

  const middleRunner: CascadeRunner = { containerId: middleContainerId, bestOf, roundCounter: { current: 0 } };
  const middle = runDropCascade(middleRunner, upperLoserFeeders);

  const lowerRunner: CascadeRunner = { containerId: lowerContainerId, bestOf, roundCounter: { current: 0 } };
  const lower = runDropCascade(lowerRunner, middle.ownLoserFeedersByStep);

  const allMatches: MatchNode[] = [...upper.matches, ...middle.matches, ...lower.matches];
  const allEdges: BracketEdge[] = [...upper.edges, ...middle.edges, ...lower.edges];

  const final1Id = `${grandFinalContainerId}-F1`;
  const final2Id = `${grandFinalContainerId}-F2`;

  // Two finals, no reset — same decision as double elimination (2026-08-31,
  // explicit user call: a bracket reset isn't a concept this project uses).
  // Final 1: Upper champion vs Middle champion. Final 2: that winner vs
  // Lower champion — winner takes the whole tournament outright.
  allMatches.push(
    { id: final1Id, containerId: grandFinalContainerId, round: 1, label: "Final 1", bestOf: grandFinalBestOf, status: "pending", seeds: [] },
    { id: final2Id, containerId: grandFinalContainerId, round: 2, label: "Final 2", bestOf: grandFinalBestOf, status: "pending", seeds: [] }
  );
  allEdges.push(
    { fromMatchId: upperChampion.matchId, fromResult: upperChampion.result, toMatchId: final1Id, toSlot: "a" },
    { fromMatchId: middle.champion.matchId, fromResult: middle.champion.result, toMatchId: final1Id, toSlot: "b" },
    { fromMatchId: final1Id, fromResult: "winner", toMatchId: final2Id, toSlot: "a" },
    { fromMatchId: lower.champion.matchId, fromResult: lower.champion.result, toMatchId: final2Id, toSlot: "b" }
  );

  return { matches: allMatches, edges: allEdges };
}

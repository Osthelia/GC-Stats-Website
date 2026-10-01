/**
 * GC-Stats — Double elimination bracket generator
 *
 * Builds an upper bracket (single elimination) plus a lower bracket fed by
 * every upper round's losers via the shared cascade runner, joined by a
 * single winner takes all grand final. No bracket reset match: the grand
 * final decides the winner regardless of which side each entrant came from.
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

export interface DoubleEliminationOptions {
  /** Container (in the stage_containers sense) that holds the upper bracket. */
  upperContainerId: string;
  /** Container that holds the lower bracket. */
  lowerContainerId: string;
  /**
   * Container that holds the grand final (a single match, no reset — see
   * the function docstring). Can be equal to upperContainerId if you'd
   * rather group everything visually — round numbering stays independent
   * per container regardless (cf. principle: a container == an independent
   * swimlane, cross-linked via bracketEdges).
   */
  grandFinalContainerId: string;
  entrantCount: number;
  bestOf?: number;
  grandFinalBestOf?: number;
}

export function generateDoubleElimination(options: DoubleEliminationOptions): BracketGraph {
  const {
    upperContainerId,
    lowerContainerId,
    grandFinalContainerId,
    entrantCount,
    bestOf = 1,
    grandFinalBestOf = bestOf,
  } = options;

  if (entrantCount < 2) {
    throw new Error(`generateDoubleElimination: entrantCount must be >= 2, got ${entrantCount}`);
  }

  const upper = generateSingleElimination({ containerId: upperContainerId, entrantCount, bestOf });
  const bracketSize = nextPowerOfTwo(entrantCount);
  const totalUpperRounds = Math.log2(bracketSize);

  // "Loser" feeder for each round of the upper bracket, in position order.
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
  if (!upperFinal) throw new Error("generateDoubleElimination: upper bracket final not found");
  const upperChampion: Feeder = { matchId: upperFinal.id, result: "winner" };

  const lowerRunner: CascadeRunner = { containerId: lowerContainerId, bestOf, roundCounter: { current: 0 } };
  const lower = runDropCascade(lowerRunner, upperLoserFeeders);
  const lowerChampion = lower.champion;

  const allMatches: MatchNode[] = [...upper.matches, ...lower.matches];
  const allEdges: BracketEdge[] = [...upper.edges, ...lower.edges];

  const grandFinalId = `${grandFinalContainerId}-GF`;

  // Single winner-takes-all grand final — no reset match. Decided
  // explicitly by the user (2026-08-31): a bracket reset isn't a concept
  // this project uses, regardless of which side the grand final entrants
  // arrived from.
  allMatches.push({
    id: grandFinalId,
    containerId: grandFinalContainerId,
    round: 1,
    label: "Grand Final",
    bestOf: grandFinalBestOf,
    status: "pending",
    seeds: [],
  });
  allEdges.push(
    { fromMatchId: upperChampion.matchId, fromResult: upperChampion.result, toMatchId: grandFinalId, toSlot: "a" },
    { fromMatchId: lowerChampion.matchId, fromResult: lowerChampion.result, toMatchId: grandFinalId, toSlot: "b" }
  );

  return { matches: allMatches, edges: allEdges };
}

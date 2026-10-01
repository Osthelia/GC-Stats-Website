/**
 * GC-Stats — Cascade runner for bracket result flows
 *
 * Shared "drop-down" match construction used by the lower/middle bracket
 * tiers of double and triple elimination: pairs survivors, drops in
 * incoming losers, and tracks winner/loser feeders through each step.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { MatchNode, BracketEdge, MatchResult } from "../graph/types";

/** Reference to the (winner|loser) result of a specific match, or `null` if
 *  no one occupies that slot (bye/pass-through absorbed higher up). */
export type Feeder = { matchId: string; result: MatchResult } | null;

export interface CascadeStepResult {
  matches: MatchNode[];
  edges: BracketEdge[];
  winners: Feeder[];
  losers: Feeder[];
}

/** Shared, mutable numbering state for one cascade (a lower/middle bracket
 *  tier) — every step increments it, matching the flat round numbering
 *  double/triple elimination have always used for these tiers. */
export interface CascadeRunner {
  containerId: string;
  bestOf: number;
  roundCounter: { current: number };
}

function makeMatch(runner: CascadeRunner, index: number): MatchNode {
  return {
    id: `${runner.containerId}-R${runner.roundCounter.current}-M${index + 1}`,
    containerId: runner.containerId,
    round: runner.roundCounter.current,
    bestOf: runner.bestOf,
    status: "pending",
    seeds: [],
  };
}

/**
 * Shared "drop-down" cascade construction used by every bracket tier below
 * the top (upper) one, for both double and triple elimination: pairs
 * consecutive survivors together (`consolidateAdjacent`) and drops incoming
 * losers from the tier above into the survivors of the previous step
 * (`dropIn`). Every created match's winner AND loser are tracked — winners
 * feed the next step of THIS cascade, losers are returned so a caller can
 * either discard them (double elimination: a 2nd loss eliminates) or feed
 * them into one more cascade of the exact same shape (triple elimination:
 * a 2nd loss drops to a 3rd tier instead of eliminating).
 *
 * Both functions pass a lone/unmatched feeder straight through untouched
 * (no match created, provenance preserved) instead of dropping it — needed
 * so triple elimination can safely reuse this on a middle bracket's own
 * loser stream, which (unlike an upper bracket's, always a clean power-of-
 * two shape) isn't guaranteed to have a "nice" length or to always have as
 * many current survivors as incoming losers at every step. This never
 * actually triggers on double elimination's own (always well-shaped) input,
 * so its output is unchanged.
 */
export function consolidateAdjacent(runner: CascadeRunner, feeders: Feeder[]): CascadeStepResult {
  runner.roundCounter.current++;
  const matches: MatchNode[] = [];
  const edges: BracketEdge[] = [];
  const winners: Feeder[] = [];
  const losers: Feeder[] = [];

  const pairCount = Math.floor(feeders.length / 2);
  for (let i = 0; i < pairCount; i++) {
    const left = feeders[2 * i] ?? null;
    const right = feeders[2 * i + 1] ?? null;
    if (left && right) {
      const match = makeMatch(runner, i);
      matches.push(match);
      edges.push({ fromMatchId: left.matchId, fromResult: left.result, toMatchId: match.id, toSlot: "a" });
      edges.push({ fromMatchId: right.matchId, fromResult: right.result, toMatchId: match.id, toSlot: "b" });
      winners.push({ matchId: match.id, result: "winner" });
      losers.push({ matchId: match.id, result: "loser" });
    } else {
      winners.push(left ?? right ?? null);
    }
  }
  if (feeders.length % 2 === 1) {
    winners.push(feeders[feeders.length - 1] ?? null);
  }

  return { matches, edges, winners, losers };
}

export function dropIn(runner: CascadeRunner, feeders: Feeder[], incomingLosers: Feeder[]): CascadeStepResult {
  runner.roundCounter.current++;
  const matches: MatchNode[] = [];
  const edges: BracketEdge[] = [];
  const winners: Feeder[] = [];
  const losers: Feeder[] = [];

  const length = Math.max(feeders.length, incomingLosers.length);
  for (let i = 0; i < length; i++) {
    const left = feeders[i] ?? null;
    const right = incomingLosers[i] ?? null;
    if (left && right) {
      const match = makeMatch(runner, i);
      matches.push(match);
      edges.push({ fromMatchId: left.matchId, fromResult: left.result, toMatchId: match.id, toSlot: "a" });
      edges.push({ fromMatchId: right.matchId, fromResult: right.result, toMatchId: match.id, toSlot: "b" });
      winners.push({ matchId: match.id, result: "winner" });
      losers.push({ matchId: match.id, result: "loser" });
    } else {
      winners.push(left ?? right ?? null);
    }
  }

  return { matches, edges, winners, losers };
}

/**
 * Runs a full cascade (one `consolidateAdjacent` seeded by round 1, then
 * alternating `dropIn`/`consolidateAdjacent` for every further round of
 * `incomingLoserFeeders`) and returns both the tier's champion (last
 * survivor) and, per internal step, the losers IT produced — ready to be
 * fed into another `runDropCascade` call for one more tier down.
 */
export function runDropCascade(
  runner: CascadeRunner,
  incomingLoserFeeders: Feeder[][]
): { matches: MatchNode[]; edges: BracketEdge[]; champion: NonNullable<Feeder>; ownLoserFeedersByStep: Feeder[][] } {
  const matches: MatchNode[] = [];
  const edges: BracketEdge[] = [];
  const ownLoserFeedersByStep: Feeder[][] = [];

  let current = consolidateAdjacent(runner, incomingLoserFeeders[0]!);
  matches.push(...current.matches);
  edges.push(...current.edges);
  ownLoserFeedersByStep.push(current.losers);

  for (let round = 2; round <= incomingLoserFeeders.length; round++) {
    const drop = dropIn(runner, current.winners, incomingLoserFeeders[round - 1]!);
    matches.push(...drop.matches);
    edges.push(...drop.edges);
    ownLoserFeedersByStep.push(drop.losers);

    if (round < incomingLoserFeeders.length) {
      current = consolidateAdjacent(runner, drop.winners);
      matches.push(...current.matches);
      edges.push(...current.edges);
      ownLoserFeedersByStep.push(current.losers);
    } else {
      current = drop;
    }
  }

  const champion = current.winners[0] ?? null;
  if (!champion) {
    throw new Error("runDropCascade: could not resolve a champion for this tier (not enough entrants for it to exist)");
  }

  return { matches, edges, champion, ownLoserFeedersByStep };
}

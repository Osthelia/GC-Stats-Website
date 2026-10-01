/**
 * GC-Stats — GSL group bracket generator
 *
 * Builds a GSL-style group of 4 (2 openers, a winners match, an elimination
 * match, and a decider) with 2 qualifying slots. Distinct from a plain
 * 4-entrant double elimination bracket: there is no grand final.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { BracketGraph, BracketEdge, MatchNode } from "../graph/types";
import { generateSingleElimination } from "./single-elimination";

export interface GslGroupOptions {
  containerId: string;
  bestOf?: number;
  /** Best of for the decider match specifically (defaults to `bestOf`). */
  deciderBestOf?: number;
}

/**
 * GSL-style group of 4: Opener A, Opener B, a Winners Match (opener
 * winners), an Elimination Match (opener losers), and a Decider between the
 * Winners Match loser and the Elimination Match winner — 5 matches total,
 * 2 qualifying slots (Winners Match winner = 1st, Decider winner = 2nd).
 *
 * NOT a plain 4-entrant double elimination bracket minus the reset match:
 * a real double-elim(4) has an extra "grand final" between the upper and
 * lower bracket champions, which GSL doesn't have (the group stops at the
 * decider). Reuses `generateSingleElimination` (already verified) for the
 * Opener A/B + Winners Match part — only the Elimination Match and Decider
 * are GSL-specific, hand-built with explicit edges.
 */
export function generateGslGroup(options: GslGroupOptions): BracketGraph {
  const { containerId, bestOf = 1, deciderBestOf = bestOf } = options;

  const upper = generateSingleElimination({ containerId, entrantCount: 4, bestOf });
  const openerA = upper.matches.find((m) => m.id === `${containerId}-R1-M1`);
  const openerB = upper.matches.find((m) => m.id === `${containerId}-R1-M2`);
  const winnersMatch = upper.matches.find((m) => m.id === `${containerId}-R2-M1`);
  if (!openerA || !openerB || !winnersMatch) {
    throw new Error("generateGslGroup: unexpected single-elimination(4) shape");
  }

  const eliminationId = `${containerId}-ELIM`;
  const deciderId = `${containerId}-DECIDER`;

  const labeled: Record<string, string> = {
    [openerA.id]: "Opener A",
    [openerB.id]: "Opener B",
    [winnersMatch.id]: "Winners Match",
  };
  const matches: MatchNode[] = upper.matches.map((m) => ({ ...m, label: labeled[m.id] ?? m.label }));

  matches.push(
    { id: eliminationId, containerId, round: 2, label: "Elimination Match", bestOf, status: "pending", seeds: [] },
    { id: deciderId, containerId, round: 3, label: "Decider", bestOf: deciderBestOf, status: "pending", seeds: [] }
  );

  const edges: BracketEdge[] = [
    ...upper.edges,
    { fromMatchId: openerA.id, fromResult: "loser", toMatchId: eliminationId, toSlot: "a" },
    { fromMatchId: openerB.id, fromResult: "loser", toMatchId: eliminationId, toSlot: "b" },
    { fromMatchId: winnersMatch.id, fromResult: "loser", toMatchId: deciderId, toSlot: "a" },
    { fromMatchId: eliminationId, fromResult: "winner", toMatchId: deciderId, toSlot: "b" },
  ];

  return { matches, edges };
}

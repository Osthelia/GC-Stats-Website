/**
 * GC-Stats — resolve-match.test module
 *
 * Tests resolveMatchInGraph's downstream slot filling and ready flipping.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { resolveMatchInGraph } from "./resolve-match";
import type { MatchNode } from "../graph/types";

function match(id: string, overrides: Partial<MatchNode> = {}): MatchNode {
  return { id, containerId: "c", round: 1, bestOf: 1, status: "pending", seeds: [], ...overrides };
}

describe("resolveMatchInGraph", () => {
  it("fills the winner-fed slot and does not mark ready when the other slot is still empty", () => {
    const result = resolveMatchInGraph({
      matchId: "m1",
      winnerId: "w",
      loserId: "l",
      outgoingEdges: [{ fromMatchId: "m1", fromResult: "winner", toMatchId: "m2", toSlot: "a" }],
      downstreamMatches: [match("m2")],
    });
    expect(result.patches).toEqual([{ matchId: "m2", slot: "a", entrantId: "w", becomesReady: false }]);
  });

  it("marks the downstream match ready once the last slot is filled", () => {
    const result = resolveMatchInGraph({
      matchId: "m1",
      winnerId: "w",
      loserId: "l",
      outgoingEdges: [{ fromMatchId: "m1", fromResult: "winner", toMatchId: "m2", toSlot: "b" }],
      downstreamMatches: [match("m2", { entrantAId: "already-here" })],
    });
    expect(result.patches).toEqual([{ matchId: "m2", slot: "b", entrantId: "w", becomesReady: true }]);
  });

  it("propagates the loser to a loser-bracket edge", () => {
    const result = resolveMatchInGraph({
      matchId: "m1",
      winnerId: "w",
      loserId: "l",
      outgoingEdges: [{ fromMatchId: "m1", fromResult: "loser", toMatchId: "lb1", toSlot: "a" }],
      downstreamMatches: [match("lb1")],
    });
    expect(result.patches).toEqual([{ matchId: "lb1", slot: "a", entrantId: "l", becomesReady: false }]);
  });

  it("fills both downstream matches when winner and loser feed different matches (grand final + reset skip)", () => {
    const result = resolveMatchInGraph({
      matchId: "m1",
      winnerId: "w",
      loserId: "l",
      outgoingEdges: [
        { fromMatchId: "m1", fromResult: "winner", toMatchId: "gf", toSlot: "a" },
        { fromMatchId: "m1", fromResult: "loser", toMatchId: "lb-final", toSlot: "b" },
      ],
      downstreamMatches: [match("gf", { entrantBId: "someone" }), match("lb-final", { entrantAId: "someone-else" })],
    });
    expect(result.patches).toHaveLength(2);
    const gfPatch = result.patches.find((p) => p.matchId === "gf")!;
    const lbPatch = result.patches.find((p) => p.matchId === "lb-final")!;
    expect(gfPatch).toEqual({ matchId: "gf", slot: "a", entrantId: "w", becomesReady: true });
    expect(lbPatch).toEqual({ matchId: "lb-final", slot: "b", entrantId: "l", becomesReady: true });
  });

  it("does not flip an already-live/completed downstream match back to ready", () => {
    const result = resolveMatchInGraph({
      matchId: "m1",
      winnerId: "w",
      loserId: "l",
      outgoingEdges: [{ fromMatchId: "m1", fromResult: "winner", toMatchId: "m2", toSlot: "a" }],
      downstreamMatches: [match("m2", { status: "live", entrantBId: "x" })],
    });
    expect(result.patches[0]!.becomesReady).toBe(false);
  });

  it("ignores edges that don't originate from the resolved match", () => {
    const result = resolveMatchInGraph({
      matchId: "m1",
      winnerId: "w",
      loserId: "l",
      outgoingEdges: [{ fromMatchId: "other", fromResult: "winner", toMatchId: "m2", toSlot: "a" }],
      downstreamMatches: [match("m2")],
    });
    expect(result.patches).toEqual([]);
  });
});

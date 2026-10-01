/**
 * GC-Stats — double-elimination.test module
 *
 * Tests generateDoubleElimination's bracket shape and grand final wiring.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { generateDoubleElimination } from "./double-elimination";
import { validateGraph } from "../graph/validate";
import { isByeMatch } from "../graph/types";

const SIZES = [2, 3, 4, 5, 6, 7, 8, 11, 13, 16, 17, 32, 37, 64];

function makeGraph(entrantCount: number) {
  return generateDoubleElimination({
    upperContainerId: "ub",
    lowerContainerId: "lb",
    grandFinalContainerId: "gf",
    entrantCount,
  });
}

describe("generateDoubleElimination", () => {
  it.each(SIZES)("produces a valid DAG with no orphans for entrantCount=%i", (entrantCount) => {
    const graph = makeGraph(entrantCount);
    const result = validateGraph(graph);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it.each(SIZES)("has exactly one grand final and no reset match for entrantCount=%i", (entrantCount) => {
    const graph = makeGraph(entrantCount);
    expect(graph.matches.filter((m) => m.id === "gf-GF")).toHaveLength(1);
    expect(graph.matches.some((m) => m.id.includes("RESET"))).toBe(false);
    // The grand final has no outgoing edge — it's the true end of the graph.
    expect(graph.edges.some((e) => e.fromMatchId === "gf-GF")).toBe(false);
  });

  it.each(SIZES)("grand final receives exactly one edge from the upper bracket and one from the lower bracket for entrantCount=%i", (entrantCount) => {
    const graph = makeGraph(entrantCount);
    const incoming = graph.edges.filter((e) => e.toMatchId === "gf-GF");
    expect(incoming).toHaveLength(2);
    expect(incoming.map((e) => e.toSlot).sort()).toEqual(["a", "b"]);
    // One of the two always comes from the upper bracket's "wins" path
    // (winner of the last ub-* match), the other from the lower bracket
    // champion (whether it's a real lb-* match or, in the 2-entrant case,
    // the direct loser of the single match played).
    expect(incoming.some((e) => e.fromResult === "winner" && e.fromMatchId.startsWith("ub-"))).toBe(true);
  });

  it("2-entrant case has no lower bracket matches, loser of the single match feeds the grand final directly", () => {
    const graph = makeGraph(2);
    const lowerMatches = graph.matches.filter((m) => m.containerId === "lb");
    expect(lowerMatches).toHaveLength(0);
    const gfIncoming = graph.edges.filter((e) => e.toMatchId === "gf-GF");
    expect(gfIncoming.some((e) => e.fromMatchId === "ub-R1-M1" && e.fromResult === "loser")).toBe(true);
  });

  it("8-entrant case has the expected lower bracket shape (6 matches across 4 rounds)", () => {
    const graph = makeGraph(8);
    const lowerMatches = graph.matches.filter((m) => m.containerId === "lb");
    expect(lowerMatches).toHaveLength(6);
    const byRound = new Map<number, number>();
    for (const m of lowerMatches) byRound.set(m.round, (byRound.get(m.round) ?? 0) + 1);
    expect([...byRound.entries()].sort()).toEqual([
      [1, 2],
      [2, 2],
      [3, 1],
      [4, 1],
    ]);
  });

  it.each(SIZES)("no lower bracket match has two bye-only feeders (no phantom byes below the upper bracket) for entrantCount=%i", (entrantCount) => {
    const graph = makeGraph(entrantCount);
    // Every lower bracket match that exists necessarily has two real
    // incoming entries (pass-throughs with no opponent never create a
    // node): checked indirectly by making sure no lower match is a "bye
    // match" in the isByeMatch sense (which only applies to round-1 seeds
    // anyway — here we just check that no lower match has fewer than 2
    // incoming edges).
    const lowerMatches = graph.matches.filter((m) => m.containerId === "lb");
    const incomingCount = new Map<string, number>();
    for (const e of graph.edges) incomingCount.set(e.toMatchId, (incomingCount.get(e.toMatchId) ?? 0) + 1);
    for (const m of lowerMatches) {
      expect(incomingCount.get(m.id)).toBe(2);
      expect(isByeMatch(m)).toBe(false);
    }
  });

  it("rejects entrantCount < 2", () => {
    expect(() => makeGraph(1)).toThrow();
    expect(() => makeGraph(0)).toThrow();
  });
});

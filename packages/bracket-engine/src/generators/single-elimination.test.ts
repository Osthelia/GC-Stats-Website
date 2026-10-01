/**
 * GC-Stats — single-elimination.test module
 *
 * Tests generateSingleElimination's bracket shape, byes, and seeding.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { generateSingleElimination } from "./single-elimination";
import { validateGraph } from "../graph/validate";
import { isByeMatch } from "../graph/types";
import { nextPowerOfTwo } from "../graph/seed-order";

const NON_TRIVIAL_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 16, 17, 24, 32, 37, 63, 64, 100, 127, 128];

describe("generateSingleElimination", () => {
  it.each(NON_TRIVIAL_SIZES)("produces a valid DAG with no orphans for entrantCount=%i", (entrantCount) => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount });
    const result = validateGraph(graph);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it.each(NON_TRIVIAL_SIZES)("has exactly bracketSize - 1 matches for entrantCount=%i", (entrantCount) => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount });
    const bracketSize = nextPowerOfTwo(entrantCount);
    expect(graph.matches).toHaveLength(bracketSize - 1);
  });

  it.each(NON_TRIVIAL_SIZES)("has exactly one final match with no outgoing edge for entrantCount=%i", (entrantCount) => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount });
    const withOutgoing = new Set(graph.edges.map((e) => e.fromMatchId));
    const finals = graph.matches.filter((m) => !withOutgoing.has(m.id));
    expect(finals).toHaveLength(1);
  });

  it.each(NON_TRIVIAL_SIZES)("has exactly bracketSize - entrantCount bye matches, all in round 1, for entrantCount=%i", (entrantCount) => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount });
    const bracketSize = nextPowerOfTwo(entrantCount);
    const byeMatches = graph.matches.filter(isByeMatch);
    expect(byeMatches).toHaveLength(bracketSize - entrantCount);
    expect(byeMatches.every((m) => m.round === 1)).toBe(true);
  });

  it("does not create a bye for an exact power of two (entrantCount=8)", () => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount: 8 });
    expect(graph.matches.filter(isByeMatch)).toHaveLength(0);
    expect(graph.matches).toHaveLength(7);
  });

  it("assigns byes to the top seeds first (entrantCount=5 -> bracketSize=8, 3 byes)", () => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount: 5 });
    const round1 = graph.matches.filter((m) => m.round === 1);
    const realSeeds = round1
      .flatMap((m) => m.seeds)
      .filter((s) => s.source.type === "seed")
      .map((s) => (s.source as { type: "seed"; seed: number }).seed)
      .sort((a, b) => a - b);
    // The 5 real entrants must be seeds 1..5 (no bye assigned to top seeds)
    expect(realSeeds).toEqual([1, 2, 3, 4, 5]);
  });

  it("round-1 pairing follows standard seeding for entrantCount=8 (1v8, 4v5, 2v7, 3v6)", () => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount: 8 });
    const round1 = graph.matches.filter((m) => m.round === 1).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const pairs = round1.map((m) => {
      const a = m.seeds.find((s) => s.slot === "a")!.source as { type: "seed"; seed: number };
      const b = m.seeds.find((s) => s.slot === "b")!.source as { type: "seed"; seed: number };
      return [a.seed, b.seed];
    });
    expect(pairs).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });

  it("rejects entrantCount < 2", () => {
    expect(() => generateSingleElimination({ containerId: "c1", entrantCount: 1 })).toThrow();
    expect(() => generateSingleElimination({ containerId: "c1", entrantCount: 0 })).toThrow();
  });

  it.each(NON_TRIVIAL_SIZES)("every non-round-1 match has exactly 2 incoming edges for entrantCount=%i", (entrantCount) => {
    const graph = generateSingleElimination({ containerId: "c1", entrantCount });
    const incomingCount = new Map<string, number>();
    for (const edge of graph.edges) {
      incomingCount.set(edge.toMatchId, (incomingCount.get(edge.toMatchId) ?? 0) + 1);
    }
    for (const match of graph.matches) {
      if (match.round === 1) continue;
      expect(incomingCount.get(match.id)).toBe(2);
    }
  });
});

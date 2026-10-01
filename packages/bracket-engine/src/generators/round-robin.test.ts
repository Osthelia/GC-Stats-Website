/**
 * GC-Stats — round-robin.test module
 *
 * Tests generateRoundRobin's pairing coverage, uniqueness, and shape.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { generateRoundRobin } from "./round-robin";
import { validateGraph } from "../graph/validate";

const SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 16, 17, 24, 32];

function seedPair(match: ReturnType<typeof generateRoundRobin>["matches"][number]): [number, number] {
  const a = match.seeds.find((s) => s.slot === "a")!.source as { type: "seed"; seed: number };
  const b = match.seeds.find((s) => s.slot === "b")!.source as { type: "seed"; seed: number };
  return [a.seed, b.seed];
}

describe("generateRoundRobin (single)", () => {
  it.each(SIZES)("produces a valid graph for entrantCount=%i", (entrantCount) => {
    const graph = generateRoundRobin({ containerId: "g", entrantCount });
    const result = validateGraph(graph);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it.each(SIZES)("has exactly n*(n-1)/2 matches for entrantCount=%i", (entrantCount) => {
    const graph = generateRoundRobin({ containerId: "g", entrantCount });
    expect(graph.matches).toHaveLength((entrantCount * (entrantCount - 1)) / 2);
  });

  it.each(SIZES)("every pairing is unique (no duplicate confrontation) for entrantCount=%i", (entrantCount) => {
    const graph = generateRoundRobin({ containerId: "g", entrantCount });
    const seen = new Set<string>();
    for (const match of graph.matches) {
      const [a, b] = seedPair(match);
      const key = [a, b].sort((x, y) => x - y).join("-");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it.each(SIZES)("every entrant plays every other entrant exactly once for entrantCount=%i", (entrantCount) => {
    const graph = generateRoundRobin({ containerId: "g", entrantCount });
    const opponents = new Map<number, Set<number>>();
    for (let s = 1; s <= entrantCount; s++) opponents.set(s, new Set());
    for (const match of graph.matches) {
      const [a, b] = seedPair(match);
      opponents.get(a)!.add(b);
      opponents.get(b)!.add(a);
    }
    for (let s = 1; s <= entrantCount; s++) {
      expect(opponents.get(s)!.size).toBe(entrantCount - 1);
    }
  });

  it.each(SIZES)("no seed appears twice within the same round for entrantCount=%i", (entrantCount) => {
    const graph = generateRoundRobin({ containerId: "g", entrantCount });
    const byRound = new Map<number, number[]>();
    for (const match of graph.matches) {
      const [a, b] = seedPair(match);
      const list = byRound.get(match.round) ?? [];
      list.push(a, b);
      byRound.set(match.round, list);
    }
    for (const seeds of byRound.values()) {
      expect(new Set(seeds).size).toBe(seeds.length);
    }
  });

  it("rejects entrantCount < 2", () => {
    expect(() => generateRoundRobin({ containerId: "g", entrantCount: 1 })).toThrow();
    expect(() => generateRoundRobin({ containerId: "g", entrantCount: 0 })).toThrow();
  });
});

describe("generateRoundRobin (double)", () => {
  it.each(SIZES)("has exactly n*(n-1) matches for entrantCount=%i", (entrantCount) => {
    const graph = generateRoundRobin({ containerId: "g", entrantCount, double: true });
    expect(graph.matches).toHaveLength(entrantCount * (entrantCount - 1));
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });

  it("every pairing occurs exactly twice, once with each side swapped (entrantCount=6)", () => {
    const graph = generateRoundRobin({ containerId: "g", entrantCount: 6, double: true });
    const counts = new Map<string, [number, number]>(); // key -> [asA, asB] counts per seed order
    for (const match of graph.matches) {
      const [a, b] = seedPair(match);
      const key = [a, b].sort((x, y) => x - y).join("-");
      const entry = counts.get(key) ?? [0, 0];
      counts.set(key, entry);
      entry[a < b ? 0 : 1]++;
    }
    for (const [, [asLowFirst, asHighFirst]] of counts) {
      expect(asLowFirst).toBe(1);
      expect(asHighFirst).toBe(1);
    }
  });
});

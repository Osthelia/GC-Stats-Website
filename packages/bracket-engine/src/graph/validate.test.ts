/**
 * GC-Stats — validate.test module
 *
 * Tests validateGraph's slot feeding, orphan, and cycle detection checks.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { validateGraph } from "./validate";
import type { BracketGraph, MatchNode } from "./types";

function match(id: string, overrides: Partial<MatchNode> = {}): MatchNode {
  return { id, containerId: "c", round: 1, bestOf: 1, status: "pending", seeds: [], ...overrides };
}

describe("validateGraph", () => {
  it("accepts a well-formed graph (seeds on m1, edges feeding m2)", () => {
    const graph: BracketGraph = {
      matches: [
        match("m1", {
          seeds: [
            { slot: "a", source: { type: "seed", seed: 1 } },
            { slot: "b", source: { type: "seed", seed: 4 } },
          ],
        }),
        match("m2", {
          seeds: [{ slot: "b", source: { type: "seed", seed: 2 } }],
        }),
      ],
      edges: [{ fromMatchId: "m1", fromResult: "winner", toMatchId: "m2", toSlot: "a" }],
    };
    expect(validateGraph(graph)).toEqual({ valid: true, errors: [] });
  });

  it("flags a slot fed by two edges", () => {
    const graph: BracketGraph = {
      matches: [match("m1"), match("m2"), match("m3", { seeds: [{ slot: "b", source: { type: "bye" } }] })],
      edges: [
        { fromMatchId: "m1", fromResult: "winner", toMatchId: "m3", toSlot: "a" },
        { fromMatchId: "m2", fromResult: "winner", toMatchId: "m3", toSlot: "a" },
      ],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("slot m3:a is fed by more than one edge");
  });

  it("flags a slot fed by both a seed and an edge", () => {
    const graph: BracketGraph = {
      matches: [
        match("m1"),
        match("m2", {
          seeds: [
            { slot: "a", source: { type: "seed", seed: 1 } },
            { slot: "b", source: { type: "bye" } },
          ],
        }),
      ],
      edges: [{ fromMatchId: "m1", fromResult: "winner", toMatchId: "m2", toSlot: "a" }],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("slot m2:a is fed by both a seed and an edge");
  });

  it("flags an unfed slot (orphan)", () => {
    const graph: BracketGraph = {
      matches: [match("m1", { seeds: [{ slot: "a", source: { type: "seed", seed: 1 } }] })],
      edges: [],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('match m1 has an unfed slot "b" (orphan)');
  });

  it("flags an edge referencing an unknown match", () => {
    const graph: BracketGraph = {
      matches: [match("m1", { seeds: [{ slot: "b", source: { type: "bye" } }] })],
      edges: [{ fromMatchId: "ghost", fromResult: "winner", toMatchId: "m1", toSlot: "a" }],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("edge references unknown fromMatchId=ghost");
  });

  it("detects a simple cycle", () => {
    const graph: BracketGraph = {
      matches: [match("m1"), match("m2")],
      edges: [
        { fromMatchId: "m1", fromResult: "winner", toMatchId: "m2", toSlot: "a" },
        { fromMatchId: "m2", fromResult: "winner", toMatchId: "m1", toSlot: "a" },
      ],
    };
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("cycle detected"))).toBe(true);
  });
});

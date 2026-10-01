/**
 * GC-Stats — swiss-pairing-engine.test module
 *
 * Tests Swiss round pairing, grouping, byes, anti-rematch, and Buchholz.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import {
  pairRound,
  groupByRecord,
  recomputeBuchholz,
  type SwissConfig,
  type SwissEntrant,
  type SwissHistoryEntry,
} from "./swiss-pairing-engine";

function makeEntrant(id: string, seed: number, overrides: Partial<SwissEntrant> = {}): SwissEntrant {
  return {
    id,
    seed,
    wins: 0,
    losses: 0,
    buchholz: 0,
    roundDiff: 0,
    hadBye: false,
    status: "active",
    ...overrides,
  };
}

const BASE_CONFIG: SwissConfig = {
  qualifyAtWins: 3,
  eliminateAtLosses: 3,
  maxRounds: 5,
  roundFormat: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 3 },
  tiebreakers: ["buchholz", "round_diff", "seed"],
};

function pairsToUnorderedSet(pairings: { aId: string; bId: string | null }[]) {
  return new Set(pairings.map((p) => [p.aId, p.bId ?? "BYE"].sort().join("-")));
}

describe("groupByRecord", () => {
  it("groups by exact (wins, losses), not by diff", () => {
    const entrants = [
      makeEntrant("2-1a", 1, { wins: 2, losses: 1 }),
      makeEntrant("1-0a", 2, { wins: 1, losses: 0 }),
      makeEntrant("2-1b", 3, { wins: 2, losses: 1 }),
    ];
    const groups = groupByRecord(entrants);
    // 2-1 (better record, more wins) comes before 1-0 despite same diff (+1)
    expect(groups).toHaveLength(2);
    expect(groups[0]!.map((e) => e.id).sort()).toEqual(["2-1a", "2-1b"]);
    expect(groups[1]!.map((e) => e.id)).toEqual(["1-0a"]);
  });
});

describe("pairRound", () => {
  it("pairs an even round-1 pool fully with no byes", () => {
    const entrants = Array.from({ length: 8 }, (_, i) => makeEntrant(`e${i + 1}`, i + 1));
    const result = pairRound({ round: 1, entrants, history: [], config: BASE_CONFIG });
    expect(result.pairings).toHaveLength(4);
    expect(result.pairings.every((p) => p.bId !== null)).toBe(true);
    const allIds = result.pairings.flatMap((p) => [p.aId, p.bId]);
    expect(new Set(allIds).size).toBe(8); // every entrant paired exactly once
  });

  it("gives exactly one bye when the active pool is odd", () => {
    const entrants = Array.from({ length: 7 }, (_, i) => makeEntrant(`e${i + 1}`, i + 1));
    const result = pairRound({ round: 1, entrants, history: [], config: BASE_CONFIG });
    const byes = result.pairings.filter((p) => p.bId === null);
    expect(byes).toHaveLength(1);
    const paired = result.pairings.filter((p) => p.bId !== null).flatMap((p) => [p.aId, p.bId]);
    expect(new Set([...paired, ...byes.map((b) => b.aId)]).size).toBe(7);
  });

  it("excludes qualified/eliminated entrants from pairing", () => {
    const entrants = [
      makeEntrant("qualified", 1, { status: "qualified", wins: 3 }),
      makeEntrant("eliminated", 2, { status: "eliminated", losses: 3 }),
      ...Array.from({ length: 4 }, (_, i) => makeEntrant(`active${i}`, i + 3)),
    ];
    const result = pairRound({ round: 2, entrants, history: [], config: BASE_CONFIG });
    const allIds = result.pairings.flatMap((p) => [p.aId, p.bId]);
    expect(allIds).not.toContain("qualified");
    expect(allIds).not.toContain("eliminated");
    expect(result.pairings).toHaveLength(2);
  });

  it("uses the configured bestOf for the round", () => {
    const entrants = Array.from({ length: 4 }, (_, i) => makeEntrant(`e${i + 1}`, i + 1));
    const result = pairRound({ round: 5, entrants, history: [], config: BASE_CONFIG });
    expect(result.bestOf).toBe(3);
  });

  it("never repeats a pairing across rounds when a rematch-free option exists (anti-rematch, simulated multi-round)", () => {
    // 8 entrants, everyone at 1-1 after round 1 in two possible splits —
    // simulate round 2 pairings avoiding round-1 opponents.
    const entrants: SwissEntrant[] = Array.from({ length: 8 }, (_, i) =>
      makeEntrant(`e${i + 1}`, i + 1, { wins: 1, losses: 1 })
    );
    const round1History: SwissHistoryEntry[] = [
      { round: 1, aId: "e1", bId: "e2" },
      { round: 1, aId: "e3", bId: "e4" },
      { round: 1, aId: "e5", bId: "e6" },
      { round: 1, aId: "e7", bId: "e8" },
    ];
    const result = pairRound({ round: 2, entrants, history: round1History, config: BASE_CONFIG });
    for (const p of result.pairings) {
      const played = round1History.some(
        (h) => (h.aId === p.aId && h.bId === p.bId) || (h.bId === p.aId && h.aId === p.bId)
      );
      expect(played).toBe(false);
    }
  });

  it("floats to the adjacent group when a forced rematch conflict makes the exact group unpairable", () => {
    // Group of 2 (e1, e2) has already played each other — no valid
    // in-group pairing exists. They must float down and pair against the
    // next group instead of being forced into a rematch.
    const entrants: SwissEntrant[] = [
      makeEntrant("e1", 1, { wins: 2, losses: 0 }),
      makeEntrant("e2", 2, { wins: 2, losses: 0 }),
      makeEntrant("e3", 3, { wins: 1, losses: 1 }),
      makeEntrant("e4", 4, { wins: 1, losses: 1 }),
    ];
    const history: SwissHistoryEntry[] = [{ round: 1, aId: "e1", bId: "e2" }];
    const result = pairRound({ round: 3, entrants, history, config: BASE_CONFIG });
    expect(result.pairings).toHaveLength(2);
    // Neither pairing should be the forced e1-vs-e2 rematch.
    const rematch = result.pairings.some(
      (p) => (p.aId === "e1" && p.bId === "e2") || (p.aId === "e2" && p.bId === "e1")
    );
    expect(rematch).toBe(false);
    const allIds = result.pairings.flatMap((p) => [p.aId, p.bId]);
    expect(new Set(allIds).size).toBe(4);
  });

  it("bye priority goes to whoever has never had one, never twice before everyone has had one", () => {
    const entrants: SwissEntrant[] = [
      makeEntrant("e1", 1, { hadBye: true }),
      makeEntrant("e2", 2, { hadBye: false }),
      makeEntrant("e3", 3, { hadBye: false }),
    ];
    const result = pairRound({ round: 1, entrants, history: [], config: BASE_CONFIG });
    const bye = result.pairings.find((p) => p.bId === null);
    expect(bye).toBeDefined();
    expect(bye!.aId).not.toBe("e1"); // e1 already had a bye, must not get another
  });

  it("is deterministic (same inputs -> same pairings)", () => {
    const entrants = Array.from({ length: 6 }, (_, i) => makeEntrant(`e${i + 1}`, i + 1));
    const a = pairRound({ round: 1, entrants, history: [], config: BASE_CONFIG });
    const b = pairRound({ round: 1, entrants, history: [], config: BASE_CONFIG });
    expect(pairsToUnorderedSet(a.pairings)).toEqual(pairsToUnorderedSet(b.pairings));
  });
});

describe("recomputeBuchholz", () => {
  it("sums the current win count of every opponent faced", () => {
    const entrants: SwissEntrant[] = [
      makeEntrant("a", 1, { wins: 2 }),
      makeEntrant("b", 2, { wins: 1 }),
      makeEntrant("c", 3, { wins: 3 }),
    ];
    // a played b (round 1) and c (round 2)
    const history: SwissHistoryEntry[] = [
      { round: 1, aId: "a", bId: "b" },
      { round: 2, aId: "a", bId: "c" },
    ];
    const result = recomputeBuchholz(entrants, history);
    const a = result.find((e) => e.id === "a")!;
    // opponents' wins: b=1, c=3 -> sum=4 -> stored *100
    expect(a.buchholz).toBe(400);
  });

  it("a bye contributes 0 to buchholz", () => {
    const entrants: SwissEntrant[] = [makeEntrant("a", 1, { wins: 1 })];
    const history: SwissHistoryEntry[] = [{ round: 1, aId: "a", bId: null }];
    const result = recomputeBuchholz(entrants, history);
    expect(result[0]!.buchholz).toBe(0);
  });
});

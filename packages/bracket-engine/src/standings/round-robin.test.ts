/**
 * GC-Stats — round-robin.test module
 *
 * Tests createRoundRobinStandings' ranking and tiebreaker logic.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { createRoundRobinStandings } from "./round-robin";
import type { StandingsEntry } from "./types";

describe("createRoundRobinStandings", () => {
  it("ranks by wins first", () => {
    const calc = createRoundRobinStandings({ tiebreakers: ["round_diff", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 1, wins: 1, losses: 2, buchholz: 0, roundDiff: 0 },
      { id: "b", seed: 2, wins: 3, losses: 0, buchholz: 0, roundDiff: 0 },
      { id: "c", seed: 3, wins: 2, losses: 1, buchholz: 0, roundDiff: 0 },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("breaks ties with round_diff then seed", () => {
    const calc = createRoundRobinStandings({ tiebreakers: ["round_diff", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 5, wins: 2, losses: 1, buchholz: 0, roundDiff: 3 },
      { id: "b", seed: 1, wins: 2, losses: 1, buchholz: 0, roundDiff: 5 },
      { id: "c", seed: 2, wins: 2, losses: 1, buchholz: 0, roundDiff: 3 },
    ];
    const result = calc.recompute(entries);
    // b has the best round_diff (5); a and c tie on round_diff (3), seed breaks it (2 < 5)
    expect(result.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("uses head_to_head before falling through to seed", () => {
    const calc = createRoundRobinStandings({ tiebreakers: ["head_to_head", "seed"] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 1, wins: 2, losses: 1, buchholz: 0, roundDiff: 0, headToHead: new Map([["b", "loss"]]) },
      { id: "b", seed: 2, wins: 2, losses: 1, buchholz: 0, roundDiff: 0, headToHead: new Map([["a", "win"]]) },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("stays deterministic (no crash, no undefined rank) on a 3-way head_to_head cycle", () => {
    const calc = createRoundRobinStandings({ tiebreakers: ["head_to_head", "seed"] });
    // A beat B, B beat C, C beat A: no transitive ranking exists.
    const entries: StandingsEntry[] = [
      {
        id: "a",
        seed: 1,
        wins: 1,
        losses: 1,
        buchholz: 0,
        roundDiff: 0,
        headToHead: new Map([
          ["b", "win"],
          ["c", "loss"],
        ]),
      },
      {
        id: "b",
        seed: 2,
        wins: 1,
        losses: 1,
        buchholz: 0,
        roundDiff: 0,
        headToHead: new Map([
          ["a", "loss"],
          ["c", "win"],
        ]),
      },
      {
        id: "c",
        seed: 3,
        wins: 1,
        losses: 1,
        buchholz: 0,
        roundDiff: 0,
        headToHead: new Map([
          ["b", "loss"],
          ["a", "win"],
        ]),
      },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
    expect(result.every((r) => Number.isInteger(r.rank))).toBe(true);
  });

  it("assigns equal ranks to fully tied entries (competition ranking, not dense)", () => {
    const calc = createRoundRobinStandings({ tiebreakers: [] });
    const entries: StandingsEntry[] = [
      { id: "a", seed: 1, wins: 2, losses: 0, buchholz: 0, roundDiff: 0 },
      { id: "b", seed: 1, wins: 2, losses: 0, buchholz: 0, roundDiff: 0 },
      { id: "c", seed: 3, wins: 1, losses: 1, buchholz: 0, roundDiff: 0 },
    ];
    const result = calc.recompute(entries);
    expect(result.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

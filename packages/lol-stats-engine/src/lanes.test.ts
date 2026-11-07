/**
 * GC-Stats — lanes.test module
 *
 * Lane order of a roster entry, the lanes taken from games when none are stored, and the roster ordering. No
 * network, no database.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { areLanes, compareByLanes, laneRank, lanesByCount, lanesPlayedInPeriod, sortLanes, type PlayedLane } from "./lanes";

const game = (lane: string | null, day: string | null): PlayedLane => ({ lane, playedAt: day ? new Date(`${day}T18:00:00Z`) : null });

describe("laneRank", () => {
  it("numbers the lanes from Top to Support", () => {
    expect(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].map(laneRank)).toEqual([0, 1, 2, 3, 4]);
  });

  it("ranks anything that is not a lane after Support", () => {
    expect([laneRank(null), laneRank(undefined), laneRank("AFK")]).toEqual([5, 5, 5]);
  });
});

describe("areLanes", () => {
  it("accepts lanes only", () => {
    expect(areLanes(["TOP", "UTILITY"])).toBe(true);
    expect(areLanes([])).toBe(true);
    expect(areLanes(["TOP", "top"])).toBe(false);
  });
});

describe("sortLanes", () => {
  it("puts the lanes in order from Top to Support, once each", () => {
    expect(sortLanes(["UTILITY", "TOP", "UTILITY", "MIDDLE"])).toEqual(["TOP", "MIDDLE", "UTILITY"]);
  });

  it("drops what is not a lane", () => {
    expect(sortLanes(["BOTTOM", "AFK", "", null, undefined, "top"])).toEqual(["BOTTOM"]);
  });
});

describe("lanesByCount", () => {
  it("puts the most played lane first", () => {
    expect(lanesByCount(["MIDDLE", "TOP", "TOP", "TOP", "MIDDLE"])).toEqual(["TOP", "MIDDLE"]);
    expect(lanesByCount(["BOTTOM", "UTILITY", "UTILITY"])).toEqual(["UTILITY", "BOTTOM"]);
  });

  it("breaks a tie in lane order", () => {
    expect(lanesByCount(["UTILITY", "JUNGLE", "UTILITY", "JUNGLE"])).toEqual(["JUNGLE", "UTILITY"]);
  });

  it("ignores games without a known lane", () => {
    expect(lanesByCount([null, "TOP", null])).toEqual(["TOP"]);
    expect(lanesByCount([])).toEqual([]);
  });
});

describe("lanesPlayedInPeriod", () => {
  const games = [game("TOP", "2025-02-01"), game("TOP", "2025-03-01"), game("MIDDLE", "2025-04-01"), game("MIDDLE", "2025-05-01"), game("MIDDLE", "2025-06-01"), game("JUNGLE", null)];

  it("counts only the games inside the period, the day after the last one excluded", () => {
    expect(lanesPlayedInPeriod(games, { since: "2025-02-01", until: "2025-05-01", hasLeft: true })).toEqual(["TOP", "MIDDLE"]);
    expect(lanesPlayedInPeriod(games, { since: "2025-02-01", until: "2025-04-01", hasLeft: true })).toEqual(["TOP"]);
  });

  it("counts every game from the start of an open period", () => {
    expect(lanesPlayedInPeriod(games, { since: "2025-04-01", until: null, hasLeft: false })).toEqual(["MIDDLE"]);
  });

  it("gives nothing before the first game", () => {
    expect(lanesPlayedInPeriod(games, { since: "2024-01-01", until: "2025-01-01", hasLeft: true })).toEqual([]);
  });

  it("gives nothing for an entry left with an unknown end", () => {
    expect(lanesPlayedInPeriod(games, { since: "2025-02-01", until: null, hasLeft: true })).toEqual([]);
  });

  it("skips games without a date", () => {
    expect(lanesPlayedInPeriod([game("JUNGLE", null)], { since: null, until: null, hasLeft: false })).toEqual([]);
  });
});

describe("compareByLanes", () => {
  it("orders by the first lane, Top before Support", () => {
    const rows = [["UTILITY"], ["TOP", "JUNGLE"], ["MIDDLE"], ["JUNGLE"]];
    expect(rows.sort(compareByLanes)).toEqual([["TOP", "JUNGLE"], ["JUNGLE"], ["MIDDLE"], ["UTILITY"]]);
  });

  it("puts people without a lane last", () => {
    expect([[], ["UTILITY"]].sort(compareByLanes)).toEqual([["UTILITY"], []]);
    expect(laneRank(undefined)).toBe(5);
  });
});

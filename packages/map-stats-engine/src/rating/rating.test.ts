/**
 * GC-Stats - rating.test module
 *
 * Unit tests for the GCS rating: round timeline, win probability credit
 * split, utility assist detection, trades and the role-relative scoring.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { agentKey, agentRole } from "./agent-roles";
import { computeRatingRecords } from "./components";
import { ratingKillCause } from "./kill-cause";
import { CLUTCH_BONUS_BY_OPPONENTS, DAMAGE_ASSIST_SHARE, TRADED_DEATH_FACTOR, UTILITY_ASSIST_SHARE } from "./constants";
import { buildRatingModel, rateRecord } from "./rating";
import type { RatingKill, RatingMapInput, RatingPlayer, RatingRound, WinProbCounts } from "./types";
import { accumulateWinProb, atkWinProb, buildRoundTimeline } from "./win-probability";

const RED = ["r1", "r2", "r3", "r4", "r5"];
const BLUE = ["b1", "b2", "b3", "b4", "b5"];

function players(): RatingPlayer[] {
  return [
    ...RED.map((id) => ({ id, team: "Red" as const, agent: "jett", role: "duelist" as const })),
    ...BLUE.map((id) => ({ id, team: "Blue" as const, agent: "omen", role: "controller" as const })),
  ];
}

function kill(timeMs: number, killer: string | null, victim: string, assistants: string[] = [], cause: RatingKill["cause"] = killer ? "player" : "self"): RatingKill {
  return { timeMs, cause, killer, victim, assistants };
}

function round(kills: RatingKill[], overrides: Partial<RatingRound> = {}): RatingRound {
  return { roundNum: 1, atkTeam: "Red", winnerTeam: "Red", plantTimeMs: null, planter: null, defuser: null, loadouts: {}, kills, damages: [], ...overrides };
}

function input(rounds: RatingRound[]): RatingMapInput {
  return { players: players(), rounds };
}

/** Coarse table where each alive player of advantage is worth 9 points and a plant 15. */
function seededCounts(): WinProbCounts {
  const counts: WinProbCounts = {};
  for (const planted of [0, 1]) {
    for (let diff = -5; diff <= 5; diff++) counts[`d${diff}p${planted}`] = [10000, Math.round(10000 * Math.min(0.97, Math.max(0.03, 0.5 + 0.09 * diff + 0.15 * planted)))];
  }
  return counts;
}

const sideSums = (records: ReturnType<typeof computeRatingRecords>, id: string) => records.find((r) => r.id === id)!.sides;

describe("agent roles", () => {
  it("normalizes display names", () => {
    expect(agentKey("KAY/O")).toBe("kayo");
    expect(agentRole("KAY/O")).toBe("initiator");
    expect(agentRole("Unknown Agent")).toBeNull();
  });
});

describe("round timeline", () => {
  it("interleaves the plant with kills by time", () => {
    const timeline = buildRoundTimeline(round([kill(1000, "r1", "b1"), kill(5000, "b2", "r2")], { plantTimeMs: 3000, planter: "r3" }), input([]));
    expect(timeline.events.map((e) => e.type)).toEqual(["kill", "plant", "kill"]);
    expect(timeline.end).toEqual({ atk: 4, def: 4, planted: true });
  });

  it("puts a revived victim back before their second death", () => {
    const timeline = buildRoundTimeline(round([kill(1000, "r1", "b1"), kill(2000, "r1", "b1")]), input([]));
    expect(timeline.events[1]!.before.def).toBe(5);
    expect(timeline.end.def).toBe(4);
  });
});

describe("win probability", () => {
  it("is fixed on decided states and learned otherwise", () => {
    const counts = {};
    accumulateWinProb(counts, input([round([kill(1000, "r1", "b1")], { winnerTeam: "Red" })]));
    expect(atkWinProb(counts, { atk: 5, def: 0, planted: false }, "e")).toBe(1);
    expect(atkWinProb(counts, { atk: 0, def: 3, planted: false }, "e")).toBe(0);
    expect(atkWinProb(counts, { atk: 5, def: 4, planted: false }, "e")).toBeGreaterThan(0.5);
  });
});

describe("rating components", () => {
  const counts = seededCounts();
  const opening = (assistants: string[], damages: RatingRound["damages"] = []) => round([kill(1000, "r1", "b1", assistants)], { damages });
  const delta = atkWinProb(counts, { atk: 5, def: 4, planted: false }, "e") - atkWinProb(counts, { atk: 5, def: 5, planted: false }, "e");

  it("credits the killer and debits the victim with the win probability delta", () => {
    expect(delta).toBeGreaterThan(0.05);
    const records = computeRatingRecords(input([opening([])]), counts);
    expect(sideSums(records, "r1").atk.sums.imp).toBeCloseTo(delta);
    expect(sideSums(records, "b1").def.sums.imp).toBeCloseTo(-delta);
    expect(sideSums(records, "r1").atk.sums.opn).toBe(1);
    expect(sideSums(records, "b1").def.sums.opn).toBe(-1);
  });

  it("gives a utility assist (no damage on the victim) a bigger share than a damage assist", () => {
    const records = computeRatingRecords(input([opening(["r2", "r3"], [{ attacker: "r3", receiver: "b1", damage: 40 }])]), counts);
    expect(sideSums(records, "r2").atk.sums.imp).toBeCloseTo(UTILITY_ASSIST_SHARE * delta);
    expect(sideSums(records, "r3").atk.sums.imp).toBeCloseTo(DAMAGE_ASSIST_SHARE * delta);
    expect(sideSums(records, "r1").atk.sums.imp).toBeCloseTo((1 - UTILITY_ASSIST_SHARE - DAMAGE_ASSIST_SHARE) * delta);
    expect(sideSums(records, "r2").atk.sums.ast).toBe(1);
    expect(sideSums(records, "r3").atk.sums.ast).toBe(0.5);
  });

  it("halves the cost of a traded death", () => {
    const records = computeRatingRecords(input([round([kill(1000, "b1", "r1"), kill(2500, "r2", "b1")])]), counts);
    expect(sideSums(records, "r1").atk.sums.srv).toBe(1 - TRADED_DEATH_FACTOR);
    expect(sideSums(records, "r1").atk.sums.kst).toBe(1);
  });

  it("debits the team killer, not the victim", () => {
    const records = computeRatingRecords(input([round([kill(1000, "r1", "r2")])]), counts);
    expect(sideSums(records, "r1").atk.sums.imp).toBeLessThan(0);
    expect(sideSums(records, "r2").atk.sums.imp).toBe(0);
    expect(sideSums(records, "r1").atk.sums.kil).toBe(0);
  });

  it("gives the defuse no value: the kill wiping the attackers after the plant takes it all", () => {
    const kills = ["r1", "r2", "r3", "r4", "r5"].map((victim, i) => kill(1000 * (i + 2), "b1", victim));
    const records = computeRatingRecords(input([round(kills, { plantTimeMs: 500, planter: "r2", defuser: "b2", winnerTeam: "Blue" })]), counts);
    expect(sideSums(records, "b2").def.sums.imp).toBe(0);
    expect(sideSums(records, "r2").atk.sums.imp).not.toBe(0);
    expect(atkWinProb(counts, { atk: 0, def: 5, planted: true }, "e")).toBe(0);
  });

  it("keeps environmental deaths neutral and penalizes deaths to one's own utility", () => {
    const env = computeRatingRecords(input([round([kill(1000, null, "r1", [], "environment")])]), counts);
    expect(sideSums(env, "r1").atk.sums.imp).toBe(0);
    expect(sideSums(env, "r1").atk.sums.srv).toBe(1);
    expect(sideSums(env, "r1").atk.sums.kst).toBe(1);
    const self = computeRatingRecords(input([round([kill(1000, null, "r1", [], "self")])]), counts);
    expect(sideSums(self, "r1").atk.sums.imp).toBeLessThan(0);
    expect(sideSums(self, "r1").atk.sums.srv).toBe(0);
  });

  it("classifies causes from the damage type", () => {
    expect(ratingKillCause(null, "Fall")).toBe("environment");
    expect(ratingKillCause("b1", "Fall")).toBe("player");
    expect(ratingKillCause(null, "Bomb")).toBe("environment");
    expect(ratingKillCause(null, "Ability")).toBe("self");
    expect(ratingKillCause("b1", "Weapon")).toBe("player");
  });

  it("counts a won clutch with its size", () => {
    const kills = [
      kill(1000, "b1", "r1"),
      kill(2000, "b1", "r2"),
      kill(3000, "b1", "r3"),
      kill(4000, "b1", "r4"),
      kill(5000, "r5", "b1"),
      kill(6000, "r5", "b2"),
      kill(7000, "r5", "b3"),
      kill(8000, "r5", "b4"),
      kill(9000, "r5", "b5"),
    ];
    const records = computeRatingRecords(input([round(kills, { winnerTeam: "Red" })]), counts);
    const r5 = records.find((r) => r.id === "r5")!;
    expect(r5.clutchesWon).toBe(1);
    expect(r5.clutchPoints).toBe(CLUTCH_BONUS_BY_OPPONENTS[5]);
  });
});

describe("rating model", () => {
  it("centers each role on 1.00 and rewards the better player of a role", () => {
    const rounds: RatingRound[] = [];
    for (let i = 0; i < 24; i++) {
      // r1 kills on most rounds, the rest of the server trades kills evenly.
      const killer = i % 4 === 0 ? "r2" : "r1";
      rounds.push(round([kill(1000, killer, BLUE[i % 5]!), kill(2000, BLUE[(i + 1) % 5]!, RED[(i % 4) + 1]!)], { roundNum: i, winnerTeam: i % 3 === 0 ? "Blue" : "Red" }));
    }
    const maps = [input(rounds), input(rounds.map((r) => ({ ...r, kills: [...r.kills].reverse() })))];
    const counts = {};
    for (const map of maps) accumulateWinProb(counts, map);
    const records = maps.flatMap((m) => computeRatingRecords(m, counts));
    const model = buildRatingModel(counts, records);
    const ratings = records.map((r) => ({ id: r.id, rating: rateRecord(r, model)!.rating }));
    const duelists = ratings.filter((r) => r.id.startsWith("r"));
    const mean = duelists.reduce((a, b) => a + b.rating, 0) / duelists.length;
    expect(mean).toBeCloseTo(1, 1);
    expect(ratings.find((r) => r.id === "r1")!.rating).toBeGreaterThan(ratings.find((r) => r.id === "r5")!.rating);
  });
});

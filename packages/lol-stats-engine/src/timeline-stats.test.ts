/**
 * GC-Stats — timeline-stats.test module
 *
 * Unit tests for the derived timeline stats against a real exported LoL game.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { roleOf, type LeagueSide } from "./game-summary";
import { buildTimelineRows, type LeagueTimelineContext } from "./timeline-rows";
import { computeFirstBlood, computeFirstTower, computeLaneDiffs, computeObjectiveTimings, type LanePlayer } from "./timeline-stats";
import type { RiotMatchDto, RiotTimelineDto } from "./types";

const fixturePath = fileURLToPath(new URL("./__fixtures__/lol-game-example.json", import.meta.url));
const game = JSON.parse(readFileSync(fixturePath, "utf-8"));
const match: RiotMatchDto = game.match;
const timeline: RiotTimelineDto = game.timeline;

const sideOf = (teamId: number): LeagueSide => (teamId === 100 ? "blue" : "red");
const context: LeagueTimelineContext = {
  gameId: 1,
  personIdByParticipantId: new Map(match.info.participants.map((p) => [p.participantId, p.participantId])),
  sideByParticipantId: new Map(match.info.participants.map((p) => [p.participantId, sideOf(p.teamId)])),
};
const rows = buildTimelineRows(timeline, context);
const players: LanePlayer[] = match.info.participants.map((p) => ({ personId: p.participantId, side: sideOf(p.teamId), role: roleOf(p.teamPosition) }));

describe("computeLaneDiffs (real LoL game)", () => {
  const diffs = computeLaneDiffs(rows, players);

  it("makes each lane diff the mirror of the opponent's, using the frame at the mark", () => {
    // Participant 2 (blue UTILITY) faces participant 9 (red UTILITY).
    expect(diffs.get(2)?.goldDiff10).toBe(-diffs.get(9)!.goldDiff10!);
    const gold = (personId: number) => rows.frames.find((f) => f.personId === personId && f.frame === 10)!.totalGold;
    expect(diffs.get(3)?.goldDiff10).toBe(gold(3) - gold(7));
  });

  it("gives the AFK participant no diffs, because they have no lane opponent", () => {
    const afk = match.info.participants.find((p) => p.teamPosition === "AFK")!;
    expect(diffs.get(afk.participantId)?.csDiff15).toBeNull();
  });
});

describe("computeFirstBlood and computeFirstTower (real LoL game)", () => {
  it("returns the first champion kill, with its killer and side", () => {
    expect(computeFirstBlood(rows)).toEqual({ personId: 7, side: "red", timeMs: 305983 });
  });

  it("returns the team that took the first tower, not the team that lost it", () => {
    // The first TOWER_BUILDING is blue's (teamId 100), so red took it.
    expect(computeFirstTower(rows)).toEqual({ side: "red", timeMs: 951370 });
  });
});

describe("computeObjectiveTimings (real LoL game)", () => {
  it("records the first time each objective kind was taken, per side", () => {
    const timings = computeObjectiveTimings(rows);
    expect(timings.blue).toMatchObject({ DRAGON: 432505, HORDE: 516484 });
    expect(timings.red).toMatchObject({ HORDE: 557580, DRAGON: 846251, RIFTHERALD: 940884 });
  });
});

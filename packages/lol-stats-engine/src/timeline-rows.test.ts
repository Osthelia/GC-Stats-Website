/**
 * GC-Stats — timeline-rows.test module
 *
 * Unit tests for buildTimelineRows against a real exported LoL game timeline
 * (50 frames, 10 participants), plus small hand-written timelines for the
 * cases the real game does not contain.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LeagueSide } from "./game-summary";
import { buildTimelineRows, type LeagueTimelineContext } from "./timeline-rows";
import type { RiotMatchDto, RiotTimelineDto } from "./types";

const fixturePath = fileURLToPath(new URL("./__fixtures__/lol-game-example.json", import.meta.url));
const game = JSON.parse(readFileSync(fixturePath, "utf-8"));
const match: RiotMatchDto = game.match;
const timeline: RiotTimelineDto = game.timeline;

// Person id = Riot participant id, so the assertions read directly against the timeline.
const context: LeagueTimelineContext = {
  gameId: 1,
  personIdByParticipantId: new Map(match.info.participants.map((p) => [p.participantId, p.participantId])),
  sideByParticipantId: new Map(match.info.participants.map((p) => [p.participantId, p.teamId === 100 ? "blue" : "red"])),
};

describe("buildTimelineRows (real LoL game: 50 frames, 2060 events)", () => {
  const rows = buildTimelineRows(timeline, context);

  it("writes every frame and event, with events in Riot's order", () => {
    expect(rows.frames).toHaveLength(50 * 10);
    expect(rows.events).toHaveLength(2060);
    expect(rows.events.map((e) => e.seq)).toEqual(rows.events.map((_, i) => i));
  });

  it("gives every champion kill a victim, and maps the first kill's killer, side and damage data", () => {
    const kills = rows.events.filter((e) => e.type === "CHAMPION_KILL");
    expect(kills).toHaveLength(41);
    expect(kills.every((e) => e.targetPersonId !== null)).toBe(true);
    expect(kills[0]).toMatchObject({ timeMs: 305983, personId: 7, targetPersonId: 2, side: "red", bounty: 300 });
    expect(kills[0]?.data).toHaveProperty("victimDamageDealt");
    expect(kills[0]?.data).not.toHaveProperty("position");
  });

  it("keeps the building type as the subtype and the tower type in data", () => {
    const tower = rows.events.find((e) => e.type === "BUILDING_KILL" && e.subtype === "TOWER_BUILDING");
    expect(tower?.data).toHaveProperty("towerType");
    expect(rows.events.some((e) => e.type === "BUILDING_KILL" && e.subtype === "INHIBITOR_BUILDING")).toBe(true);
  });

  it("returns no rows for a null timeline (chronobreak)", () => {
    expect(buildTimelineRows(null, context)).toEqual({ frames: [], events: [] });
  });
});

describe("buildTimelineRows (hand-written cases)", () => {
  const participants = Array.from({ length: 10 }, (_, i) => i + 1);
  const map = (ids: number[]) => new Map(ids.map((id) => [id, id]));

  it("maps killerId 0 (minion, tower, monster) to no person, and an event without a team to the actor's side", () => {
    const timeline = minimalTimeline([{ type: "CHAMPION_KILL", timestamp: 1000, killerId: 0, victimId: 3, position: { x: 1, y: 2 } }]);
    const [minionKill] = buildTimelineRows(timeline, { gameId: 1, personIdByParticipantId: map(participants), sideByParticipantId: new Map() }).events;
    expect(minionKill).toMatchObject({ personId: null, targetPersonId: 3, x: 1, y: 2 });

    const withActor = minimalTimeline([{ type: "CHAMPION_KILL", timestamp: 1000, killerId: 8, victimId: 3 }]);
    const sides = new Map<number, LeagueSide>([[8, "red"]]);
    const [kill] = buildTimelineRows(withActor, { gameId: 1, personIdByParticipantId: map(participants), sideByParticipantId: sides }).events;
    expect(kill?.side).toBe("red");
  });

  it("throws when a participant has no person, so a partial import never gets written", () => {
    const timeline = minimalTimeline([{ type: "LEVEL_UP", timestamp: 1000, participantId: 10 }]);
    const ctx = { gameId: 1, personIdByParticipantId: map(participants.slice(0, 9)), sideByParticipantId: new Map<number, LeagueSide>() };
    expect(() => buildTimelineRows(timeline, ctx)).toThrow(/Riot participant 10 has no person/);
  });
});

function minimalTimeline(events: Record<string, unknown>[]): RiotTimelineDto {
  return {
    metadata: { dataVersion: "2", matchId: "TEST_1", participants: [] },
    info: {
      frameInterval: 60000,
      gameId: 1,
      participants: [],
      frames: [{ timestamp: 0, participantFrames: {}, events: events as RiotTimelineDto["info"]["frames"][number]["events"] }],
    },
  };
}

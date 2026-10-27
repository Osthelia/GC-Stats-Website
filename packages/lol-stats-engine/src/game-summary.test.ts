/**
 * GC-Stats — game-summary.test module
 *
 * Unit tests for buildGameSummary and roleOf against a real exported LoL game
 * (Match-V5 match + timeline, one game of a best-of-5).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGameSummary, roleOf } from "./game-summary";
import type { RiotMatchDto } from "./types";

const fixturePath = fileURLToPath(new URL("./__fixtures__/lol-game-example.json", import.meta.url));
const match: RiotMatchDto = JSON.parse(readFileSync(fixturePath, "utf-8")).match;

const personIdByPuuid = new Map(match.info.participants.map((p) => [p.puuid, p.participantId]));
const summary = buildGameSummary(match, {
  gameId: 1,
  order: 1,
  entrantIdBySide: { blue: 10, red: 20 },
  personIdByPuuid,
  championNameById: new Map(),
});

describe("buildGameSummary (real LoL game: 10 players, 2 teams, red won)", () => {
  it("builds the game row, the winner entrant and one player and team row per side", () => {
    expect(summary.game).toMatchObject({ order: 1, apiMatchId: "LOLTMNT01_296476", durationSeconds: 2928, winnerEntrantId: 20 });
    expect(summary.players).toHaveLength(10);
    expect(summary.teams).toHaveLength(2);
    expect(summary.teams.reduce((sum, t) => sum + t.kills, 0)).toBe(summary.players.reduce((sum, p) => sum + p.kills, 0));
  });

  it("writes a pick for every participant and a ban with its pick turn", () => {
    expect(summary.draft.filter((d) => d.type === "pick")).toHaveLength(10);
    expect(summary.draft.filter((d) => d.type === "ban").every((b) => b.order !== null)).toBe(true);
  });
});

describe("champion names", () => {
  it("uses the catalog display name for picks and players, and Riot's name when the id is unknown", () => {
    const named = buildGameSummary(match, {
      gameId: 1,
      order: 1,
      entrantIdBySide: { blue: 10, red: 20 },
      personIdByPuuid,
      championNameById: new Map([[59, "Jarvan IV"]]),
    });
    expect(named.draft.find((d) => d.type === "pick" && d.entrantId === 10 && d.championName === "Jarvan IV")).toBeDefined();
    expect(named.players.map((p) => p.championName)).toContain("Jarvan IV");
    expect(named.players.map((p) => p.championName)).toContain("Ahri"); // no catalog entry: Riot's name, same as its display name
  });
});

describe("roleOf", () => {
  it("keeps the five lanes and drops empty and non-lane positions, so they never pair with an opponent", () => {
    for (const lane of ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]) {
      expect(roleOf(lane)).toBe(lane);
    }
    expect(roleOf("")).toBeNull();
    expect(roleOf("AFK")).toBeNull();
    expect(roleOf("Invalid")).toBeNull();
  });
});

describe("summoner spells and the rune page", () => {
  it("keeps both summoner spells and the whole rune page of every player", () => {
    const raw = match.info.participants[0]!;
    const row = summary.players.find((p) => p.personId === raw.participantId)!;
    expect(row.summoners).toEqual([raw.spell1Id, raw.spell2Id]);
    expect(row.runes.primaryPerks).toEqual(raw.perks.styles[0]!.selections.map((s) => s.perk));
    expect(row.runes.subPerks).toEqual(raw.perks.styles[1]!.selections.map((s) => s.perk));
    expect(row.runes.statPerks).toEqual(raw.perks.statPerks);
  });
});

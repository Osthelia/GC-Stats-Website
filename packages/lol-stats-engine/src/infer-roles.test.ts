/**
 * GC-Stats — infer-roles.test module
 *
 * Player roles: the lobby role (positionAssignedByMatchmaking, or the lobby order for older games) and the check
 * from the first minutes of the timeline. On two real games where Riot's teamPosition is AFK for one player per team
 * and wrong for others: LOLTMNT05_219302 (2026, has the field) and LOLTMNT01_296476 (2025, no field, a lane swap).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assignedRoles, buildGameSummary, LEAGUE_ROLES, roleOf } from "./game-summary";
import { inferRoles, resolvePlayerRoles } from "./infer-roles";
import { namesForEveryChampion } from "./test-helpers";
import type { RiotMatchDto, RiotTimelineDto } from "./types";

const fixturePath = fileURLToPath(new URL("./__fixtures__/lol-game-stage4-2026.json", import.meta.url));
const fixture: { match: RiotMatchDto; timeline: RiotTimelineDto } = JSON.parse(readFileSync(fixturePath, "utf-8"));
const { match, timeline } = fixture;
const olderPath = fileURLToPath(new URL("./__fixtures__/lol-game-example.json", import.meta.url));
const older: { match: RiotMatchDto; timeline: RiotTimelineDto } = JSON.parse(readFileSync(olderPath, "utf-8"));

/** Role by champion name, for readable expectations. */
function byChampion(game: RiotMatchDto, roles: Map<number, string | null> | null): Record<string, string | null | undefined> {
  return Object.fromEntries(game.info.participants.map((p) => [p.championName, roles?.get(p.participantId)]));
}

describe("inferRoles", () => {
  it("gives each team one player per role", () => {
    const roles = inferRoles(match, timeline)!;
    for (const teamId of [100, 200]) {
      const teamRoles = match.info.participants.filter((p) => p.teamId === teamId).map((p) => roles.get(p.participantId));
      expect([...teamRoles].sort()).toEqual([...LEAGUE_ROLES].sort());
    }
  });

  it("places the players where they stand in the first minutes", () => {
    const roles = inferRoles(match, timeline)!;
    const expected: Record<number, string> = {
      1: "TOP", // Ambessa, Riot: AFK
      2: "JUNGLE", // Vi
      3: "MIDDLE", // Orianna
      4: "BOTTOM", // Sivir, the higher CS of the bottom pair
      5: "UTILITY", // Leona
      6: "TOP", // Renekton, Riot: AFK
      7: "JUNGLE", // Poppy
      8: "MIDDLE", // Hwei
      9: "BOTTOM", // Jinx
      10: "UTILITY", // Bard
    };
    expect(Object.fromEntries([...roles].map(([id, role]) => [id, role]))).toEqual(expected);
  });

  it("is null without a timeline", () => {
    expect(inferRoles(match, null)).toBeNull();
  });
});

describe("assignedRoles", () => {
  it("uses Riot's positionAssignedByMatchmaking when the game has it", () => {
    const roles = assignedRoles(match);
    for (const p of match.info.participants) expect(roles.get(p.participantId)).toBe(p.positionAssignedByMatchmaking);
  });

  it("uses the lobby order for a game from before the field existed", () => {
    expect(older.match.info.participants.some((p) => p.positionAssignedByMatchmaking !== undefined)).toBe(false);
    const roles = assignedRoles(older.match);
    for (const p of older.match.info.participants) expect(roles.get(p.participantId)).toBe(LEAGUE_ROLES[(p.participantId - 1) % 5]);
  });

  it("keeps the players' roles through an early lane swap, where the positions read the lanes", () => {
    // Red side: Ahri played the bottom lane with Leona and Smolder went mid for the first ten minutes.
    expect(byChampion(older.match, assignedRoles(older.match))).toMatchObject({ Ahri: "MIDDLE", Smolder: "BOTTOM" });
    expect(byChampion(older.match, inferRoles(older.match, older.timeline))).toMatchObject({ Ahri: "BOTTOM", Smolder: "MIDDLE" });
  });

  it("follows the field when it differs from the lobby order", () => {
    const swapped = structuredClone(match);
    const [first, second] = swapped.info.participants.filter((p) => p.teamId === 100);
    [first!.positionAssignedByMatchmaking, second!.positionAssignedByMatchmaking] = ["JUNGLE", "TOP"];
    const roles = assignedRoles(swapped);
    expect([roles.get(first!.participantId), roles.get(second!.participantId)]).toEqual(["JUNGLE", "TOP"]);
  });

  it("falls back to the lobby order when the field does not name all five roles of a team", () => {
    const partial = structuredClone(match);
    const [first, second] = partial.info.participants.filter((p) => p.teamId === 100);
    first!.positionAssignedByMatchmaking = "JUNGLE";
    second!.positionAssignedByMatchmaking = "JUNGLE";
    const roles = assignedRoles(partial);
    expect([roles.get(first!.participantId), roles.get(second!.participantId)]).toEqual(["TOP", "JUNGLE"]);
  });
});

describe("resolvePlayerRoles", () => {
  const ambessa = match.info.participants.find((p) => p.championName === "Ambessa")!;

  it("uses the lobby role, not Riot's AFK, when there is no override", () => {
    expect(resolvePlayerRoles(match).get(ambessa.participantId)).toBe("TOP");
    expect(roleOf(ambessa.teamPosition)).toBeNull();
  });

  it("takes the admin's override, and null clears the role", () => {
    const roles = resolvePlayerRoles(match, { [ambessa.puuid]: "MIDDLE" });
    expect(roles.get(ambessa.participantId)).toBe("MIDDLE");
    expect(resolvePlayerRoles(match, { [ambessa.puuid]: null }).get(ambessa.participantId)).toBeNull();
  });

  it("flows into the summary rows that lane diffs pair by", () => {
    const roles = resolvePlayerRoles(match, { [ambessa.puuid]: "MIDDLE" });
    const summary = buildGameSummary(match, {
      gameId: 1,
      order: 1,
      entrantIdBySide: { blue: 10, red: 20 },
      personIdByPuuid: new Map(match.info.participants.map((p) => [p.puuid, p.participantId])),
      championNameById: namesForEveryChampion(match),
      roleByParticipantId: roles,
    });
    expect(summary.players.find((p) => p.championName === "Ambessa")?.role).toBe("MIDDLE");
  });

  it("gives the summary the lobby roles when the caller passes none", () => {
    const summary = buildGameSummary(older.match, {
      gameId: 1,
      order: 1,
      entrantIdBySide: { blue: 10, red: 20 },
      personIdByPuuid: new Map(),
      championNameById: namesForEveryChampion(older.match),
    });
    expect(summary.players.find((p) => p.championName === "Smolder")?.role).toBe("BOTTOM");
  });
});

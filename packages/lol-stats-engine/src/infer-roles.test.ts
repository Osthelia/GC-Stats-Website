/**
 * GC-Stats — infer-roles.test module
 *
 * Role inference from the first minutes of the timeline, on a real game where Riot's teamPosition is
 * AFK for one player per team and wrong for others (LOLTMNT05_219302).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGameSummary, roleOf } from "./game-summary";
import { inferRoles, LEAGUE_ROLES, resolvePlayerRoles } from "./infer-roles";
import { namesForEveryChampion } from "./test-helpers";
import type { RiotMatchDto, RiotTimelineDto } from "./types";

const fixturePath = fileURLToPath(new URL("./__fixtures__/lol-game-stage4-2026.json", import.meta.url));
const fixture: { match: RiotMatchDto; timeline: RiotTimelineDto } = JSON.parse(readFileSync(fixturePath, "utf-8"));
const { match, timeline } = fixture;

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

describe("resolvePlayerRoles", () => {
  const ambessa = match.info.participants.find((p) => p.championName === "Ambessa")!;

  it("uses the inferred role, not Riot's AFK, when there is no override", () => {
    expect(resolvePlayerRoles(match, timeline).get(ambessa.participantId)).toBe("TOP");
    expect(roleOf(ambessa.teamPosition)).toBeNull();
  });

  it("takes the admin's override, and null clears the role", () => {
    const roles = resolvePlayerRoles(match, timeline, { [ambessa.puuid]: "MIDDLE" });
    expect(roles.get(ambessa.participantId)).toBe("MIDDLE");
    expect(resolvePlayerRoles(match, timeline, { [ambessa.puuid]: null }).get(ambessa.participantId)).toBeNull();
  });

  it("falls back to Riot's teamPosition without a timeline", () => {
    expect(resolvePlayerRoles(match, null).get(ambessa.participantId)).toBeNull();
  });

  it("flows into the summary rows that lane diffs pair by", () => {
    const roles = resolvePlayerRoles(match, timeline, { [ambessa.puuid]: "MIDDLE" });
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
});

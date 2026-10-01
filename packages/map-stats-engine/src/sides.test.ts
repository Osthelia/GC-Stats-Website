/**
 * GC-Stats — sides.test module
 *
 * Unit tests for attacker/defender side resolution across regular time and
 * overtime.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { attackerTeamForRound, computeRoundSides, firstHalfAttackerFallback } from "./sides";
import type { RiotMatchPlayerDto, RiotRoundResultDto } from "./types";

function round(roundNum: number, winningTeam: "Red" | "Blue", winningTeamRole: "Attacker" | "Defender" | undefined, bombPlanter: string | null = null): RiotRoundResultDto {
  return {
    roundNum,
    roundResult: "Eliminated",
    winningTeam,
    winningTeamRole,
    bombPlanter,
    bombDefuser: null,
    plantRoundTime: 0,
    plantSite: bombPlanter ? "A" : null,
    defuseRoundTime: 0,
    roundResultCode: "Elimination",
    playerStats: [],
  };
}

describe("attackerTeamForRound", () => {
  it("uses winningTeamRole directly when present", () => {
    expect(attackerTeamForRound(round(0, "Red", "Attacker"), "Red")).toBe("Red");
    expect(attackerTeamForRound(round(1, "Blue", "Defender"), "Red")).toBe("Red"); // Blue defended and won -> Red was attacking (and lost)
  });

  it("falls back to first-half/swap/OT heuristic when the role is missing", () => {
    expect(attackerTeamForRound(round(0, "Red", undefined), "Red")).toBe("Red");
    expect(attackerTeamForRound(round(12, "Red", undefined), "Red")).toBe("Blue"); // half swap
    expect(attackerTeamForRound(round(24, "Red", undefined), "Red")).toBe("Red"); // OT round 0
    expect(attackerTeamForRound(round(25, "Red", undefined), "Red")).toBe("Blue"); // OT round 1
  });
});

describe("firstHalfAttackerFallback", () => {
  it("picks the team of the first planter in the first half", () => {
    const players: RiotMatchPlayerDto[] = [
      { puuid: "a", gameName: "A", tagLine: "1", teamId: "Red", characterId: "x", stats: { score: 0, roundsPlayed: 1, kills: 0, deaths: 0, assists: 0, playtimeMillis: 0 }, isObserver: false },
      { puuid: "b", gameName: "B", tagLine: "1", teamId: "Blue", characterId: "x", stats: { score: 0, roundsPlayed: 1, kills: 0, deaths: 0, assists: 0, playtimeMillis: 0 }, isObserver: false },
    ];
    const rounds = [round(0, "Blue", undefined, null), round(1, "Red", undefined, "b")];
    expect(firstHalfAttackerFallback(rounds, players)).toBe("Blue");
  });
});

describe("computeRoundSides", () => {
  it("returns atk/def per round, def being the opposite of atk", () => {
    const players: RiotMatchPlayerDto[] = [];
    const rounds = [round(0, "Red", "Attacker"), round(1, "Blue", "Defender")];
    const sides = computeRoundSides(rounds, players);
    expect(sides.get(0)).toEqual({ atk: "Red", def: "Blue" });
    expect(sides.get(1)).toEqual({ atk: "Red", def: "Blue" });
  });
});

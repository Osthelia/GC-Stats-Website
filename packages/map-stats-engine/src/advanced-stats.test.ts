/**
 * GC-Stats — advanced-stats.test module
 *
 * Unit tests for clutches, multikills, and round-type (eco/force/full buy,
 * attack/defense) split computations in advanced-stats.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { computeClutches, computeMultikills, computeRoundTypeSplits, TEAM_ECO_MAX_LOADOUT, TEAM_FORCE_MAX_LOADOUT } from "./advanced-stats";
import { computeRoundSides } from "./sides";
import type { RiotMatchDto, RiotMatchPlayerDto, RiotRoundResultDto } from "./types";

function player(puuid: string, teamId: "Red" | "Blue"): RiotMatchPlayerDto {
  return { puuid, gameName: puuid, tagLine: "1", teamId, characterId: "x", stats: { score: 0, roundsPlayed: 1, kills: 0, deaths: 0, assists: 0, playtimeMillis: 0 }, isObserver: false };
}

function killAt(timeMs: number, killer: string, victim: string) {
  return {
    timeSinceGameStartMillis: timeMs,
    timeSinceRoundStartMillis: timeMs,
    killer,
    victim,
    victimLocation: null,
    assistants: [] as string[],
    playerLocations: [],
    finishingDamage: { damageType: "Weapon", damageItem: "UUID", isSecondaryFireMode: false },
  };
}

describe("computeMultikills", () => {
  it("buckets a round with 3 kills by the same player as 3k", () => {
    const match: RiotMatchDto = {
      matchInfo: { matchId: "m", mapId: "/x", isCompleted: true, gameStartMillis: 0 },
      players: [player("k", "Red"), player("v1", "Blue"), player("v2", "Blue"), player("v3", "Blue")],
      teams: [],
      roundResults: [
        {
          roundNum: 0,
          roundResult: "Eliminated",
          winningTeam: "Red",
          winningTeamRole: "Attacker",
          bombPlanter: null,
          bombDefuser: null,
          plantRoundTime: 0,
          plantSite: null,
          defuseRoundTime: 0,
          roundResultCode: "Elimination",
          playerStats: [
            {
              puuid: "k",
              score: 0,
              economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 },
              damage: [],
              kills: [killAt(1, "k", "v1"), killAt(2, "k", "v2"), killAt(3, "k", "v3")],
            },
          ],
        },
      ],
    };
    const result = computeMultikills(match);
    expect(result.get("k")).toEqual({ "3k": 1 });
  });
});

describe("computeClutches", () => {
  it("credits the lone survivor with a won 1v2 when their team wins", () => {
    const players = [player("r1", "Red"), player("r2", "Red"), player("b1", "Blue"), player("b2", "Blue")];
    const rounds: RiotRoundResultDto[] = [
      {
        roundNum: 0,
        roundResult: "Eliminated",
        winningTeam: "Red",
        winningTeamRole: "Attacker",
        bombPlanter: null,
        bombDefuser: null,
        plantRoundTime: 0,
        plantSite: null,
        defuseRoundTime: 0,
        roundResultCode: "Elimination",
        playerStats: [
          { puuid: "b1", score: 0, economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 }, damage: [], kills: [killAt(1, "b1", "r1")] },
          { puuid: "r2", score: 0, economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 }, damage: [], kills: [killAt(2, "r2", "b1"), killAt(3, "r2", "b2")] },
        ],
      },
    ];
    const match: RiotMatchDto = { matchInfo: { matchId: "m", mapId: "/x", isCompleted: true, gameStartMillis: 0 }, players, teams: [], roundResults: rounds };
    const result = computeClutches(match);
    expect(result.get("r2")).toEqual({ "1v2": { won: 1, total: 1 } });
  });

  it("credits both teams when each ends up with a lone survivor in the same round", () => {
    const players = [player("r1", "Red"), player("r2", "Red"), player("b1", "Blue"), player("b2", "Blue")];
    const eco = { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 };
    const rounds: RiotRoundResultDto[] = [
      {
        roundNum: 0,
        roundResult: "Eliminated",
        winningTeam: "Blue",
        winningTeamRole: "Defender",
        bombPlanter: null,
        bombDefuser: null,
        plantRoundTime: 0,
        plantSite: null,
        defuseRoundTime: 0,
        roundResultCode: "Elimination",
        playerStats: [
          { puuid: "b1", score: 0, economy: eco, damage: [], kills: [killAt(1, "b1", "r1")] },
          { puuid: "r2", score: 0, economy: eco, damage: [], kills: [killAt(2, "r2", "b1")] },
          { puuid: "b2", score: 0, economy: eco, damage: [], kills: [killAt(3, "b2", "r2")] },
        ],
      },
    ];
    const match: RiotMatchDto = { matchInfo: { matchId: "m", mapId: "/x", isCompleted: true, gameStartMillis: 0 }, players, teams: [], roundResults: rounds };
    const result = computeClutches(match);
    expect(result.get("r2")).toEqual({ "1v2": { won: 0, total: 1 } });
    expect(result.get("b2")).toEqual({ "1v1": { won: 1, total: 1 } });
  });
});

describe("computeRoundTypeSplits", () => {
  it("classifies team buy exactly at the eco/force/full-buy thresholds", () => {
    const players = [player("r1", "Red"), player("b1", "Blue")];
    const round = (roundNum: number, redLoadout: number): RiotRoundResultDto => ({
      roundNum,
      roundResult: "Eliminated",
      winningTeam: "Red",
      winningTeamRole: "Attacker",
      bombPlanter: null,
      bombDefuser: null,
      plantRoundTime: 0,
      plantSite: null,
      defuseRoundTime: 0,
      roundResultCode: "Elimination",
      playerStats: [
        { puuid: "r1", score: 0, economy: { loadoutValue: redLoadout, weapon: "", armor: "", remaining: 0, spent: 0 }, damage: [], kills: [] },
        { puuid: "b1", score: 0, economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 }, damage: [], kills: [] },
      ],
    });
    // Round 1 (not a pistol round) sits exactly at each threshold; round 2 is one credit above it.
    const rounds = [round(1, TEAM_ECO_MAX_LOADOUT), round(2, TEAM_ECO_MAX_LOADOUT + 1), round(3, TEAM_FORCE_MAX_LOADOUT), round(4, TEAM_FORCE_MAX_LOADOUT + 1)];
    const match: RiotMatchDto = { matchInfo: { matchId: "m", mapId: "/x", isCompleted: true, gameStartMillis: 0 }, players, teams: [], roundResults: rounds };
    const sides = computeRoundSides(rounds, players);
    const result = computeRoundTypeSplits(match, sides);
    const row = result.get("r1")!;
    expect(row.eco).toEqual({ won: 1, played: 1 }); // round 1: exactly at the eco ceiling
    expect(row.force).toEqual({ won: 2, played: 2 }); // rounds 2 and 3: just above eco, and exactly at the force ceiling
    expect(row.fullBuy).toEqual({ won: 1, played: 1 }); // round 4: just above the force ceiling
  });
});

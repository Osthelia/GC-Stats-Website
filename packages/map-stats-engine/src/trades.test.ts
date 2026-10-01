/**
 * GC-Stats — trades.test module
 *
 * Unit tests for computeRoundTrades' trade kill and traded victim detection
 * within TRADE_WINDOW_MS.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { computeRoundTrades, TRADE_WINDOW_MS } from "./trades";
import type { RiotRoundResultDto } from "./types";

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

function roundWith(kills: ReturnType<typeof killAt>[]): RiotRoundResultDto {
  return {
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
    playerStats: kills.map((k) => ({ puuid: k.killer, score: 0, economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 }, damage: [], kills: [k] })),
  };
}

const teamByPuuid = new Map([
  ["r1", "Red"],
  ["r2", "Red"],
  ["b1", "Blue"],
  ["b2", "Blue"],
] as const);

describe("computeRoundTrades", () => {
  it("counts a kill avenged within the window as a trade", () => {
    const r = roundWith([killAt(1000, "b1", "r1"), killAt(1000 + TRADE_WINDOW_MS, "r2", "b1")]);
    const { tradedVictimPuuids, tradeKillerPuuids } = computeRoundTrades(r, teamByPuuid);
    expect(tradedVictimPuuids.has("r1")).toBe(true);
    expect(tradeKillerPuuids).toEqual(["r2"]);
  });

  it("does not count a trade just past the window", () => {
    const r = roundWith([killAt(1000, "b1", "r1"), killAt(1000 + TRADE_WINDOW_MS + 1, "r2", "b1")]);
    const { tradedVictimPuuids, tradeKillerPuuids } = computeRoundTrades(r, teamByPuuid);
    expect(tradedVictimPuuids.size).toBe(0);
    expect(tradeKillerPuuids).toEqual([]);
  });

  it("does not count a kill from the same team as a trade", () => {
    const r = roundWith([killAt(1000, "b1", "r1"), killAt(1500, "b2", "r2")]);
    const { tradedVictimPuuids } = computeRoundTrades(r, teamByPuuid);
    expect(tradedVictimPuuids.size).toBe(0);
  });
});

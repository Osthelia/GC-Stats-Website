/**
 * GC-Stats — kill-breakdown.test module
 *
 * Unit tests for computeKillBreakdown's ability/weapon kill and fall death
 * classification.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { computeKillBreakdown } from "./kill-breakdown";
import type { RiotRoundResultDto } from "./types";

function kill(killer: string, victim: string, damageType: string, damageItem: string) {
  return {
    timeSinceGameStartMillis: 0,
    timeSinceRoundStartMillis: 0,
    killer,
    victim,
    victimLocation: null,
    assistants: [] as string[],
    playerLocations: [],
    finishingDamage: { damageType, damageItem, isSecondaryFireMode: false },
  };
}

function roundWith(kills: ReturnType<typeof kill>[]): RiotRoundResultDto {
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
    playerStats: kills.map((k) => ({ puuid: k.killer || k.victim, score: 0, economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 }, damage: [], kills: [k] })),
  };
}

const resolveWeaponName = (uuid: string) => (uuid === "VANDAL-UUID" ? "Vandal" : uuid);

describe("computeKillBreakdown", () => {
  it("buckets ability kills by literal type", () => {
    const rounds = [roundWith([kill("k", "v1", "Ability", "Ability1"), kill("k", "v2", "Ability", "GrenadeAbility"), kill("k", "v3", "Ability", "Ultimate")])];
    const result = computeKillBreakdown(rounds, resolveWeaponName);
    expect(result.get("k")?.abilityKills).toEqual({ ability1: 1, ability2: 0, grenade: 1, ultimate: 1 });
  });

  it("resolves weapon kills to a display name", () => {
    const rounds = [roundWith([kill("k", "v1", "Weapon", "VANDAL-UUID")])];
    const result = computeKillBreakdown(rounds, resolveWeaponName);
    expect(result.get("k")?.weaponKills).toEqual({ Vandal: 1 });
  });

  it("credits fall deaths to the victim, not a killer", () => {
    const rounds = [roundWith([kill("", "v1", "Fall", "")])];
    const result = computeKillBreakdown(rounds, resolveWeaponName);
    expect(result.get("v1")?.fallDeaths).toBe(1);
    expect(result.get("v1")?.weaponKills).toEqual({});
  });

  it("attributes nothing for a bomb detonation death", () => {
    const rounds = [roundWith([kill("", "v1", "Bomb", "")])];
    const result = computeKillBreakdown(rounds, resolveWeaponName);
    expect(result.size).toBe(0);
  });
});

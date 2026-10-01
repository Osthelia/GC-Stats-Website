/**
 * GC-Stats — aggregate-map.test module
 *
 * Unit tests for computeMapAggregates against a real Riot match-v1 fixture.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeMapAggregates } from "./aggregate-map";
import type { RiotMatchDto } from "./types";

const fixturePath = fileURLToPath(new URL("./__fixtures__/riot-match-example.json", import.meta.url));
const match: RiotMatchDto = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("computeMapAggregates (real Riot match-v1 fixture: 10 players, 21 rounds)", () => {
  const { playerStats, teamRoundSummary } = computeMapAggregates(match, (uuid) => uuid);

  it("produces one row per non-observer player", () => {
    expect(playerStats).toHaveLength(10);
  });

  it("preserves Riot's own kill/death totals per player", () => {
    expect(playerStats.reduce((sum, p) => sum + p.kills, 0)).toBe(144);
    expect(playerStats.reduce((sum, p) => sum + p.deaths, 0)).toBe(144);
  });

  it("splits ability vs weapon/melee kills across all players to match the raw kill counts", () => {
    const abilityTotal = playerStats.reduce((sum, p) => sum + p.abilityKills.ability1 + p.abilityKills.ability2 + p.abilityKills.grenade + p.abilityKills.ultimate, 0);
    const weaponTotal = playerStats.reduce((sum, p) => sum + Object.values(p.weaponKills).reduce((a, b) => a + b, 0), 0);
    expect(abilityTotal).toBe(8);
    expect(weaponTotal).toBe(136);
  });

  it("accounts for every round exactly once across the 4 team/side buckets", () => {
    const totalRoundsAcrossBuckets = teamRoundSummary.reduce((sum, row) => sum + row.roundsPlayed, 0);
    expect(totalRoundsAcrossBuckets).toBe(21 * 2); // each round counted once for each team (as atk or def)
  });

  it("gives every player a KAST between 0 and 100", () => {
    for (const p of playerStats) {
      expect(p.kastPercentage).toBeGreaterThanOrEqual(0);
      expect(p.kastPercentage).toBeLessThanOrEqual(100);
    }
  });

  it("records at least one clutch attempt over 21 rounds of real competitive play", () => {
    const totalClutchAttempts = playerStats.reduce((sum, p) => sum + Object.values(p.clutches).reduce((a, c) => a + c.total, 0), 0);
    expect(totalClutchAttempts).toBeGreaterThan(0);
  });
});

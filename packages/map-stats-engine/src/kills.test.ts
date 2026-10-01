/**
 * GC-Stats — kills.test module
 *
 * Unit tests for normalizeRoundKills' environmental death detection and
 * kill normalization.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { normalizeRoundKills } from "./kills";
import type { RiotRoundResultDto } from "./types";

function round(overrides: Partial<RiotRoundResultDto> = {}): RiotRoundResultDto {
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
    playerStats: [],
    ...overrides,
  };
}

describe("normalizeRoundKills", () => {
  it("keeps a normal kill with its killer", () => {
    const r = round({
      playerStats: [
        {
          puuid: "killer",
          score: 0,
          economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 },
          damage: [],
          kills: [
            {
              timeSinceGameStartMillis: 0,
              timeSinceRoundStartMillis: 1000,
              killer: "killer",
              victim: "victim",
              victimLocation: null,
              assistants: ["assist"],
              playerLocations: [],
              finishingDamage: { damageType: "Weapon", damageItem: "UUID-1", isSecondaryFireMode: false },
            },
          ],
        },
      ],
    });

    const kills = normalizeRoundKills(r);
    expect(kills).toHaveLength(1);
    expect(kills[0]).toMatchObject({ killerPuuid: "killer", victimPuuid: "victim", assistantPuuids: ["assist"] });
  });

  it("nulls out the killer for a bomb detonation death", () => {
    const r = round({
      playerStats: [
        {
          puuid: "victim",
          score: 0,
          economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 },
          damage: [],
          kills: [
            {
              timeSinceGameStartMillis: 0,
              timeSinceRoundStartMillis: 1000,
              killer: "",
              victim: "victim",
              victimLocation: null,
              assistants: [],
              playerLocations: [],
              finishingDamage: { damageType: "Bomb", damageItem: "", isSecondaryFireMode: false },
            },
          ],
        },
      ],
    });

    const kills = normalizeRoundKills(r);
    expect(kills[0]?.killerPuuid).toBeNull();
  });

  it("nulls out the killer for a self-inflicted death", () => {
    const r = round({
      playerStats: [
        {
          puuid: "p1",
          score: 0,
          economy: { loadoutValue: 0, weapon: "", armor: "", remaining: 0, spent: 0 },
          damage: [],
          kills: [
            {
              timeSinceGameStartMillis: 0,
              timeSinceRoundStartMillis: 1000,
              killer: "p1",
              victim: "p1",
              victimLocation: null,
              assistants: [],
              playerLocations: [],
              finishingDamage: { damageType: "Fall", damageItem: "", isSecondaryFireMode: false },
            },
          ],
        },
      ],
    });

    const kills = normalizeRoundKills(r);
    expect(kills[0]?.killerPuuid).toBeNull();
    expect(kills[0]?.damageType).toBe("Fall");
  });
});

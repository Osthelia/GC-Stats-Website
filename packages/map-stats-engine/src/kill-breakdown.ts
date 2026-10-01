/**
 * GC-Stats — kill-breakdown module
 *
 * Classifies each kill by weapon vs ability vs fall death and tallies
 * per-player breakdowns; port of V1's UtilityStatsAggregator, precomputed
 * per map instead of queried on demand.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { normalizeRoundKills } from "./kills";
import type { AbilityKills, RiotRoundResultDto } from "./types";

export interface KillBreakdownRow {
  abilityKills: AbilityKills;
  fallDeaths: number;
  weaponKills: Record<string, number>;
}

function emptyRow(): KillBreakdownRow {
  return { abilityKills: { ability1: 0, ability2: 0, grenade: 0, ultimate: 0 }, fallDeaths: 0, weaponKills: {} };
}

/**
 * Ability/weapon kill breakdown + fall deaths — port of V1's
 * UtilityStatsAggregator, precomputed per map instead of queried on demand.
 * `resolveWeaponName` is injected (pure lookup against an already-fetched
 * Riot content dictionary) so this stays free of any I/O.
 */
export function computeKillBreakdown(rounds: RiotRoundResultDto[], resolveWeaponName: (damageItemUuid: string) => string): Map<string, KillBreakdownRow> {
  const result = new Map<string, KillBreakdownRow>();
  const ensure = (puuid: string) => {
    let row = result.get(puuid);
    if (!row) {
      row = emptyRow();
      result.set(puuid, row);
    }
    return row;
  };

  for (const round of rounds) {
    for (const kill of normalizeRoundKills(round)) {
      if (kill.damageType === "Fall") {
        ensure(kill.victimPuuid).fallDeaths++;
        continue;
      }
      if (!kill.killerPuuid) continue; // environmental (Bomb, suicide) — no attribution

      const killerRow = ensure(kill.killerPuuid);
      if (kill.damageType === "Ability") {
        if (kill.weaponOrAbility === "Ability1") killerRow.abilityKills.ability1++;
        else if (kill.weaponOrAbility === "Ability2") killerRow.abilityKills.ability2++;
        else if (kill.weaponOrAbility === "GrenadeAbility") killerRow.abilityKills.grenade++;
        else if (kill.weaponOrAbility === "Ultimate") killerRow.abilityKills.ultimate++;
      } else if (kill.damageType === "Weapon" || kill.damageType === "Melee") {
        const name = resolveWeaponName(kill.weaponOrAbility);
        killerRow.weaponKills[name] = (killerRow.weaponKills[name] ?? 0) + 1;
      }
    }
  }

  return result;
}

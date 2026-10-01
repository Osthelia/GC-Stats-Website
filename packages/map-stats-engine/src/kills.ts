/**
 * GC-Stats — kills module
 *
 * Flattens a round's per-player kill lists into a single normalized array,
 * marking environmental deaths (no killer, self-inflicted, or bomb
 * detonation) as such rather than attributing them to a player.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotLocationDto, RiotPlayerLocationDto, RiotRoundResultDto } from "./types";

export interface NormalizedKill {
  roundNum: number;
  timeSinceRoundStartMillis: number;
  /** null = environmental death (no killer, self-inflicted, or a bomb detonation) — never attributed to a player. */
  killerPuuid: string | null;
  victimPuuid: string;
  assistantPuuids: string[];
  damageType: string;
  /** Raw Riot value: a UUID for Weapon/Melee, a literal Ability1/Ability2/GrenadeAbility/Ultimate for Ability. Unresolved — the caller resolves display names. */
  weaponOrAbility: string;
  isSecondaryFire: boolean;
  /** Passed through for the RAW positions table (apps/web) — unused by any aggregation in this package. */
  victimLocation: RiotLocationDto | null;
  playerLocations: RiotPlayerLocationDto[];
}

/** Flattens a round's per-player kill lists into one chronological-agnostic array, nulling out environmental deaths. */
export function normalizeRoundKills(round: RiotRoundResultDto): NormalizedKill[] {
  const kills: NormalizedKill[] = [];
  for (const playerStats of round.playerStats) {
    for (const kill of playerStats.kills) {
      const isEnvironmental = !kill.killer || kill.killer === kill.victim || kill.finishingDamage.damageType === "Bomb";
      kills.push({
        roundNum: round.roundNum,
        timeSinceRoundStartMillis: kill.timeSinceRoundStartMillis,
        killerPuuid: isEnvironmental ? null : kill.killer,
        victimPuuid: kill.victim,
        assistantPuuids: kill.assistants ?? [],
        damageType: kill.finishingDamage.damageType,
        weaponOrAbility: kill.finishingDamage.damageItem,
        isSecondaryFire: kill.finishingDamage.isSecondaryFireMode,
        victimLocation: kill.victimLocation,
        playerLocations: kill.playerLocations ?? [],
      });
    }
  }
  return kills;
}

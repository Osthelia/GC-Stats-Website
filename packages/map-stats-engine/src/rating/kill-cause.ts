/**
 * GC-Stats - rating kill cause
 *
 * Classifies a death for the rating, from the same fields the Riot payload
 * and the RAW table both carry.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RatingKillCause } from "./types";

const ENVIRONMENT_DAMAGE = new Set(["bomb", "crush"]);
const PLAYER_DAMAGE = new Set(["weapon", "ability", "melee"]);

/** `killer` is already null for self and environmental deaths (see normalizeRoundKills). */
export function ratingKillCause(killer: string | null, damageType: string | null | undefined): RatingKillCause {
  const type = (damageType ?? "").toLowerCase();
  if (ENVIRONMENT_DAMAGE.has(type)) return "environment";
  // A fall with a killer was caused by an enemy (knockback), it is their kill.
  if (killer) return "player";
  // No killer: own utility (or own weapon) is a real mistake, anything else is the map.
  return PLAYER_DAMAGE.has(type) ? "self" : "environment";
}

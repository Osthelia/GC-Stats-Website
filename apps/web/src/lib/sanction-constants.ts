/**
 * GC-Stats - sanction-constants
 *
 * Sanction type list and their Discord embed accent colors, harshest type
 * reads the most alarming color.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const SANCTION_TYPES = ["note", "warning", "mute", "suspension", "ban"] as const;
export type SanctionType = (typeof SANCTION_TYPES)[number];

/** Discord embed accent color per sanction type, harshest type reads the most alarming color. */
export const SANCTION_COLORS: Record<SanctionType, number> = {
  note: 0x99aab5,
  warning: 0xf1c40f,
  mute: 0x3498db,
  suspension: 0xe67e22,
  ban: 0xed4245,
};

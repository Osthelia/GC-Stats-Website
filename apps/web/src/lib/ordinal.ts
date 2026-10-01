/**
 * GC-Stats - ordinal
 *
 * Formats a placement number as an ordinal string (1 -> "1st", 2 -> "2nd",
 * ...) and its matching color, for tournament placement badges.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function ordinalPlacement(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function placementColor(placement: number): string {
  if (placement === 1) return "#e4ae22"; // gold
  if (placement === 2) return "#c9c9d0"; // silver
  if (placement === 3) return "#c98a4b"; // bronze
  return "#8f8f94";
}

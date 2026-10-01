/**
 * GC-Stats - match-score-format
 *
 * A stored score of -1 is the forfeit sentinel (loser side, derived
 * server-side). When that side has no entrant at all though, there was
 * never an opponent to forfeit against: it's an unfilled bracket slot
 * that auto-advances the other side, i.e. a bye, not a forfeit.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export function formatSideScore(score: number | null, entrantId: number | null): string {
  if (score == null) return "-";
  if (score === -1) return entrantId == null ? "BYE" : "FF";
  return String(score);
}

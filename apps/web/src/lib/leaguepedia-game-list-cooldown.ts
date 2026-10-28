/**
 * GC-Stats - leaguepedia-game-list-cooldown
 *
 * The hour between two reads of a tournament's Leaguepedia game list. The Leaguepedia bot account is rate limited,
 * so the server refuses a read inside the hour (refreshLeaguepediaGameList); the admin UI uses the same rule to show it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const GAME_LIST_COOLDOWN_MS = 60 * 60 * 1000;

/** True while the game list read at `fetchedAt` is less than an hour old. `null` (never read) is never on cooldown. */
export function isGameListOnCooldown(fetchedAt: Date | string | null, now = Date.now()): boolean {
  if (fetchedAt === null) return false;
  return now - new Date(fetchedAt).getTime() < GAME_LIST_COOLDOWN_MS;
}

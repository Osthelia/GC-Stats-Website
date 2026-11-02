/**
 * GC-Stats - match player order
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

interface OrderablePlayer {
  rating: number | null;
  acs: number;
  kills: number;
  deaths: number;
}

/** Best first: rating (rated before unrated), then ACS, then K/D. Also decides the MVP. */
export function compareMatchPlayers(a: OrderablePlayer, b: OrderablePlayer): number {
  if (a.rating != null && b.rating != null && a.rating !== b.rating) return b.rating - a.rating;
  if ((a.rating == null) !== (b.rating == null)) return a.rating == null ? 1 : -1;
  if (a.acs !== b.acs) return b.acs - a.acs;
  return b.kills / Math.max(1, b.deaths) - a.kills / Math.max(1, a.deaths);
}

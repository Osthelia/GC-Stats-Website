/**
 * GC-Stats - cache-tags
 *
 * Tags of `unstable_cache` entries, invalidated from the admin actions that
 * change the underlying data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { GameSlug } from "@gc-stats/db/game";

export const HOME_TOURNAMENTS_TAG = "home-tournaments";
export const NEWS_LANGUAGES_TAG = "news-languages";
export const TOURNAMENT_FACETS_TAG = "tournament-facets";
export const MATCH_STATS_TAG = "match-stats";

/** One match's cached data. With its game: match ids are counted per game, so the id alone would also clear the other game's match. */
export function matchTag(game: GameSlug, matchId: number): string {
  return `match:${game}:${matchId}`;
}

/**
 * GC-Stats - cache-tags
 *
 * Tags of `unstable_cache` entries, invalidated from the admin actions that
 * change the underlying data.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const HOME_TOURNAMENTS_TAG = "home-tournaments";
export const NEWS_LANGUAGES_TAG = "news-languages";
export const TOURNAMENT_FACETS_TAG = "tournament-facets";
export const MATCH_STATS_TAG = "match-stats";

export function matchTag(matchId: number): string {
  return `match:${matchId}`;
}

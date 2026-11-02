/**
 * GC-Stats - stored rating details
 *
 * Shape of `map_player_stats.rating_components`: every component (value and
 * z-score) plus the clutch bonus, so a rating can always be explained.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RatingResult } from "@gc-stats/map-stats-engine";

export function storedRatingDetails(result: RatingResult): RatingResult["components"] & { clutch: RatingResult["clutch"] } {
  return { ...result.components, clutch: result.clutch };
}

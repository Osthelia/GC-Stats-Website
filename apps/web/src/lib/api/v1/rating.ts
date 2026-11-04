/**
 * GC-Stats - rating
 *
 * Shared helpers to expose the GCS rating: SQL aggregation weighted by rated
 * rounds (same rule as the match page "All Maps" tab) and response rounding.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { mapPlayerStats } from "@gc-stats/db";

/** Rounds covered by a rating, only counting rows that have one. */
export const ratedRoundsSql = sql<number>`coalesce(sum(${mapPlayerStats.ratingRounds}) filter (where ${mapPlayerStats.rating} is not null), 0)::int`;

/** Rating averaged over maps, weighted by rated rounds, null when no map has a rating. */
export const weightedRatingSql = sql<number | null>`(sum(${mapPlayerStats.rating}::float8 * ${mapPlayerStats.ratingRounds}) filter (where ${mapPlayerStats.rating} is not null) / nullif(sum(${mapPlayerStats.ratingRounds}) filter (where ${mapPlayerStats.rating} is not null), 0))::float8`;

export function roundRating(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value * 100) / 100;
}

/** Folds map ratings into a rounds weighted average. */
export class RatingAccumulator {
  private weighted = 0;
  private rounds = 0;

  add(rating: number | null, ratingRounds: number | null): void {
    if (rating == null || !ratingRounds) return;
    this.weighted += rating * ratingRounds;
    this.rounds += ratingRounds;
  }

  get value(): number | null {
    return this.rounds > 0 ? roundRating(this.weighted / this.rounds) : null;
  }

  get ratedRounds(): number {
    return this.rounds;
  }
}

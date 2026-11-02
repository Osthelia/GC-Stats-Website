/**
 * GC-Stats - active rating model
 *
 * Loads the active GCS rating model, the one newly ingested maps are rated
 * with. Read fresh on every ingestion (small row, rare call) so a map fetched
 * right after a recompute never gets the previous model.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { desc, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { ratingModels } from "@gc-stats/db";
import { RATING_FORMULA_VERSION, type RatingModel } from "@gc-stats/map-stats-engine";

type Executor = Pick<typeof db, "select">;

async function readActiveModel(executor: Executor) {
  const [row] = await executor
    .select({ id: ratingModels.id, formulaVersion: ratingModels.formulaVersion, model: ratingModels.model })
    .from(ratingModels)
    .where(eq(ratingModels.isActive, true))
    .orderBy(desc(ratingModels.id))
    .limit(1);
  return row && row.formulaVersion === RATING_FORMULA_VERSION ? row : null;
}

/** Null when no model was computed yet, or when it was built by another formula version. */
export async function getActiveRatingModel(executor: Executor = db): Promise<{ id: number; model: RatingModel } | null> {
  const row = await readActiveModel(executor);
  return row ? { id: row.id, model: row.model as RatingModel } : null;
}

/** Active model id (same rules as getActiveRatingModel), used to key caches holding ratings so a recompute refreshes them. */
export async function getActiveRatingModelId(): Promise<number | null> {
  return (await readActiveModel(db))?.id ?? null;
}

/** Advisory lock keys: ingestion holds it shared, a recompute holds it exclusive while it writes. */
export const RATING_LOCK_KEY: [number, number] = [7301, 1];

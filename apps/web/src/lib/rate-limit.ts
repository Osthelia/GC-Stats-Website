/**
 * GC-Stats - rate-limit
 *
 * Shared rate limit entry point: Postgres fixed window (see rate-limit-db.ts),
 * shared by every replica. An in-memory counter would be per pod and multiply
 * the limit by the replica count.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { checkRateLimitDb } from "@/lib/rate-limit-db";

/** Returns true when the call is allowed. `cost` lets heavier calls consume more of the window. */
export async function checkRateLimit(key: string, windowMs: number, max: number, cost = 1): Promise<boolean> {
  return checkRateLimitDb(key, windowMs, max, cost);
}

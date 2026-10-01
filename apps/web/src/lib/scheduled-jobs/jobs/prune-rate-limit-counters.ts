/**
 * GC-Stats - prune-rate-limit-counters
 *
 * Scheduled job: deletes Postgres rate limit counters (lib/rate-limit-db.ts)
 * whose window is stale, past the longest window any limit uses.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lt } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { rateLimitCounters } from "@gc-stats/db";

/** Longest window among the Postgres-backed rate limits (lib/rate-limit-db.ts) is 1h (register/password-reset) — a row untouched for 1h is a stale, already-reset window, safe to delete. */
const MAX_WINDOW_MS = 60 * 60_000;

export async function pruneRateLimitCounters(): Promise<string> {
  const deleted = await db
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.windowStart, new Date(Date.now() - MAX_WINDOW_MS)))
    .returning({ key: rateLimitCounters.key });
  return `pruned ${deleted.length} expired rate limit counter(s)`;
}

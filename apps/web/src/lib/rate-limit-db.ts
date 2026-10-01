/**
 * GC-Stats - rate-limit-db
 *
 * Postgres-backed fixed-window rate limit for Cloudflare Workers, where a
 * per-isolate in-memory counter would be trivially bypassed. One atomic
 * UPSERT does the reset-or-increment, safe under concurrent requests.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { rateLimitCounters } from "@gc-stats/db";

/**
 * Fixed-window rate limit backed by Postgres — used only when
 * DEPLOY_TARGET=cloudflare. Workers run many isolates with no shared memory,
 * so the in-memory `Map` sliding window used elsewhere (lib/auth-throttle.ts,
 * lib/api/v1/rate-limit.ts) is per-isolate and trivially bypassed there.
 * Hyperdrive makes this a pooled, fast round-trip, so a real row is cheap
 * enough to be the source of truth instead.
 *
 * Single atomic UPSERT: resets the counter if the window has expired,
 * otherwise increments it — no separate read-then-write, safe under
 * concurrent requests. Rows are pruned by the
 * prune-rate-limit-counters scheduled job.
 */
export async function checkRateLimitDb(key: string, windowMs: number, max: number, cost = 1): Promise<boolean> {
  const rows = await db
    .insert(rateLimitCounters)
    .values({ key, count: cost, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimitCounters.key,
      set: {
        count: sql`case when ${rateLimitCounters.windowStart} <= now() - (${windowMs}::text || ' milliseconds')::interval
          then ${cost} else ${rateLimitCounters.count} + ${cost} end`,
        windowStart: sql`case when ${rateLimitCounters.windowStart} <= now() - (${windowMs}::text || ' milliseconds')::interval
          then now() else ${rateLimitCounters.windowStart} end`,
      },
    })
    .returning({ count: rateLimitCounters.count });

  return (rows[0]?.count ?? 0) <= max;
}

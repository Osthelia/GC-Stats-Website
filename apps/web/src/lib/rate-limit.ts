/**
 * GC-Stats - rate-limit
 *
 * Shared rate limit entry point: in-memory sliding window on Docker (single
 * process), Postgres fixed window on Cloudflare where isolates share no
 * memory. The in-memory store is capped so random keys can't grow it forever.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { checkRateLimitDb } from "@/lib/rate-limit-db";

const MAX_KEYS = 50_000;

type Window = { hits: { at: number; cost: number }[]; expiresAt: number };
const windows = new Map<string, Window>();

function sweep(now: number): void {
  for (const [key, w] of windows) {
    if (w.expiresAt <= now) windows.delete(key);
  }
  // Still full after dropping idle keys: drop the oldest ones.
  let overflow = windows.size - MAX_KEYS + 1;
  for (const key of windows.keys()) {
    if (overflow-- <= 0) break;
    windows.delete(key);
  }
}

function checkInMemory(key: string, windowMs: number, max: number, cost: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const existing = windows.get(key);
  const hits = (existing?.hits ?? []).filter((h) => h.at > windowStart);
  const used = hits.reduce((sum, h) => sum + h.cost, 0);

  if (!existing && windows.size >= MAX_KEYS) sweep(now);

  if (used + cost > max) {
    windows.set(key, { hits, expiresAt: existing?.expiresAt ?? now + windowMs });
    return false;
  }

  hits.push({ at: now, cost });
  windows.set(key, { hits, expiresAt: now + windowMs });
  return true;
}

/** Returns true when the call is allowed. `cost` lets heavier calls consume more of the window. */
export async function checkRateLimit(key: string, windowMs: number, max: number, cost = 1): Promise<boolean> {
  return process.env.DEPLOY_TARGET === "cloudflare" ? checkRateLimitDb(key, windowMs, max, cost) : checkInMemory(key, windowMs, max, cost);
}

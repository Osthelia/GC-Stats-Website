/**
 * GC-Stats - rate-limit
 *
 * Per API key rate limit for the public API, on top of lib/rate-limit.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { checkRateLimit as checkKeyedRateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 60_000;

/** `null` rateLimit on the key = unlimited. `cost` lets a heavier endpoint (teams/players = 10) consume more of the window per call. Returns true when the call is allowed. */
export async function checkRateLimit(apiKeyId: number, limit: number | null, cost = 1): Promise<boolean> {
  if (limit == null) return true;
  return checkKeyedRateLimit(`apikey:${apiKeyId}`, WINDOW_MS, limit, cost);
}

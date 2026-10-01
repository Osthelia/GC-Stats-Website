/**
 * GC-Stats - rate-limit
 *
 * Rate limits the /api/oauth/* endpoints (per IP before client
 * authentication, per client or user after).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { checkRateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 60_000;

/** Fixed limit per key (no per-client override, unlike api_key.rateLimit). */
export async function checkOAuthRateLimit(key: string, limit: number): Promise<boolean> {
  return checkRateLimit(`oauth:${key}`, WINDOW_MS, limit);
}

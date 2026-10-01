/**
 * GC-Stats - search-throttle
 *
 * Per-IP rate limit for the public, unauthenticated /api/search endpoint.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { checkRateLimit } from "@/lib/rate-limit";

const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX_PER_IP = 60;

/** Caps how many search requests one IP can send per minute — /api/search is public, unauthenticated and unindexed by proxy.ts. */
export async function checkSearchThrottle(ip: string): Promise<boolean> {
  const key = `search:ip:${ip}`;
  return checkRateLimit(key, SEARCH_WINDOW_MS, SEARCH_MAX_PER_IP);
}

/**
 * GC-Stats - page-view-throttle
 *
 * Rate limits the public, unauthenticated /api/track-page-view endpoint per
 * IP. In-memory on Docker, falls back to a Postgres-backed check on
 * Cloudflare where Workers isolates share no memory.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { checkRateLimit } from "@/lib/rate-limit";

const PAGE_VIEW_WINDOW_MS = 60_000;
const PAGE_VIEW_MAX_PER_IP = 60;

/** Caps how many distinct page views one IP can record per minute — /api/track-page-view is public/unauthenticated. */
export async function checkPageViewThrottle(ip: string): Promise<boolean> {
  const key = `pageview:ip:${ip}`;
  return checkRateLimit(key, PAGE_VIEW_WINDOW_MS, PAGE_VIEW_MAX_PER_IP);
}

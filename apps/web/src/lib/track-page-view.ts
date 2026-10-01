/**
 * GC-Stats - track-page-view
 *
 * Records page views into the daily/region/country bucket, called from the
 * public tracking endpoint on every client-side navigation. No Redis
 * buffer, a per-request upsert is cheap enough at day granularity.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { pageViews } from "@gc-stats/db";
import { regionFromCountry } from "@/lib/geo";

const MAX_URI_LENGTH = 512;

/** Rejects anything that isn't plausibly a page path — this endpoint is public, unauthenticated. */
export function isTrackableUri(uri: unknown): uri is string {
  return typeof uri === "string" && uri.length > 0 && uri.length <= MAX_URI_LENGTH && uri.startsWith("/") && !uri.startsWith("/api/");
}

/**
 * Upserts one page view into the daily/region/country bucket (see
 * packages/db/src/schema/platform.ts::pageViews) — called from
 * app/api/track-page-view/route.ts, fired by components/page-view-tracker.tsx
 * on every client-side navigation. No Redis buffer (V1 had one): V2's
 * pageViews is day-granularity, not hourly, so a per-request upsert is cheap
 * enough on its own.
 */
export async function recordPageView(uri: string, countryCodeHeader: string | null): Promise<void> {
  const countryCode = (countryCodeHeader ?? "UNK").toUpperCase().slice(0, 3);
  const regionCode = regionFromCountry(countryCode);
  const viewedAt = new Date().toISOString().slice(0, 10);

  await db
    .insert(pageViews)
    .values({ uri, viewedAt, countryCode, regionCode, count: 1 })
    .onConflictDoUpdate({
      target: [pageViews.uri, pageViews.viewedAt, pageViews.regionCode, pageViews.countryCode],
      set: { count: sql`${pageViews.count} + 1` },
    });
}

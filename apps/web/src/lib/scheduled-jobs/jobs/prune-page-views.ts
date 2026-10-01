/**
 * GC-Stats - prune-page-views
 *
 * Scheduled job: deletes page view rows older than the retention window,
 * since /admin/analytics only ever reads the last 30 days.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lt } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { pageViews } from "@gc-stats/db";

const RETENTION_DAYS = 60;

/** /admin/analytics only ever reads the last 30 days (admin-analytics.ts), page_views would otherwise grow forever. */
export async function prunePageViews(): Promise<string> {
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  const deleted = await db.delete(pageViews).where(lt(pageViews.viewedAt, cutoff)).returning({ uri: pageViews.uri });
  return `pruned ${deleted.length} old page view row(s)`;
}

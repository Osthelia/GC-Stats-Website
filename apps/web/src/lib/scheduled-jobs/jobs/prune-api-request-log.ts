/**
 * GC-Stats - prune-api-request-log
 *
 * Scheduled job: deletes API request log rows older than the retention window.
 * Key stats (api-key-stats.ts) never read further back than 30 days.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lt } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { apiRequestLog } from "@gc-stats/db";

/** Also stated on the public /data page. */
export const API_REQUEST_LOG_RETENTION_DAYS = 90;

export async function pruneApiRequestLog(): Promise<string> {
  const cutoff = new Date(Date.now() - API_REQUEST_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(apiRequestLog).where(lt(apiRequestLog.createdAt, cutoff)).returning({ id: apiRequestLog.id });
  return `pruned ${deleted.length} old API request log row(s)`;
}

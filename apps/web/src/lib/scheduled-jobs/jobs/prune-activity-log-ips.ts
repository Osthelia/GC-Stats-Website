/**
 * GC-Stats - prune-activity-log-ips
 *
 * Scheduled job: strips the IP from account activity log entries older than
 * the retention window. The entry itself is kept, only the IP is removed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, lt, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { activityLog } from "@gc-stats/db";

/** Also stated on the public /data page. */
export const ACTIVITY_LOG_IP_RETENTION_DAYS = 90;

export async function pruneActivityLogIps(): Promise<string> {
  const cutoff = new Date(Date.now() - ACTIVITY_LOG_IP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const updated = await db
    .update(activityLog)
    .set({ properties: sql`${activityLog.properties} - 'ip'` })
    .where(and(lt(activityLog.createdAt, cutoff), sql`${activityLog.properties} ? 'ip'`))
    .returning({ id: activityLog.id });
  return `stripped the IP from ${updated.length} old activity log entr${updated.length === 1 ? "y" : "ies"}`;
}

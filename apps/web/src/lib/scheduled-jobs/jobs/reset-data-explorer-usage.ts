/**
 * GC-Stats - reset-data-explorer-usage
 *
 * Scheduled job: drops Data Explorer usage rows old enough that nothing
 * (quota math, the admin dashboard) still reads them. Usage is already
 * partitioned by year/month, so this is table hygiene, not a real reset.
 * Mirrors V1's app:reset-data-explorer-usage.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, lt, or, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { dataExplorerUsages } from "@gc-stats/db";

const RETENTION_MONTHS = 12;

/**
 * Data Explorer usage is already partitioned by year/month, so a new month
 * "resets" on its own. This job's actual job is table hygiene: dropping
 * usage rows old enough that nothing (quota math, the admin dashboard)
 * still reads them. Mirrors V1's app:reset-data-explorer-usage.
 */
export async function resetDataExplorerUsage(): Promise<string> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const cutoffYear = cutoff.getFullYear();
  const cutoffMonth = cutoff.getMonth() + 1;

  const deleted = await db
    .delete(dataExplorerUsages)
    .where(
      or(
        lt(dataExplorerUsages.year, cutoffYear),
        and(eq(dataExplorerUsages.year, cutoffYear), lt(dataExplorerUsages.month, cutoffMonth))
      )
    )
    .returning({ id: dataExplorerUsages.id });

  return `pruned ${deleted.length} old Data Explorer usage row(s)`;
}

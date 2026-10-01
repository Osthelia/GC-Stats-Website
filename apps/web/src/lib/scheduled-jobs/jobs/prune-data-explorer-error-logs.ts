/**
 * GC-Stats - prune-data-explorer-error-logs
 *
 * Scheduled job: deletes Data Explorer error logs older than the retention
 * window. These exist only so a user's "Error ID" references something
 * real for support, not as a permanent audit trail.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lt } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { dataExplorerErrorLogs } from "@gc-stats/db";

const RETENTION_DAYS = 30;

/** data_explorer_error_logs exists to let a user's "Error ID" reference something real for support/debugging, not to be a permanent audit trail. Mirrors V1's app:prune-data-explorer-error-logs. */
export async function pruneDataExplorerErrorLogs(): Promise<string> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(dataExplorerErrorLogs).where(lt(dataExplorerErrorLogs.createdAt, cutoff)).returning({ id: dataExplorerErrorLogs.id });
  return `pruned ${deleted.length} old Data Explorer error log(s)`;
}

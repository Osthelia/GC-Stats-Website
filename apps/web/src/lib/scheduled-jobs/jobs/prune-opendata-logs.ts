/**
 * GC-Stats - prune-opendata-logs
 *
 * Scheduled job: deletes OpenData request log rows and load samples older
 * than their retention window.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lt } from "drizzle-orm";
import { openDataDb } from "@gc-stats/db/client";
import { opendataRequestLog, opendataPressureSamples } from "@gc-stats/db";

/** Also stated on the public /data page. */
export const OPENDATA_REQUEST_LOG_RETENTION_DAYS = 30;
const OPENDATA_SAMPLES_RETENTION_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function pruneOpenDataLogs(): Promise<string> {
  const now = Date.now();
  const requests = await openDataDb
    .delete(opendataRequestLog)
    .where(lt(opendataRequestLog.createdAt, new Date(now - OPENDATA_REQUEST_LOG_RETENTION_DAYS * DAY_MS)));
  const samples = await openDataDb
    .delete(opendataPressureSamples)
    .where(lt(opendataPressureSamples.sampledAt, new Date(now - OPENDATA_SAMPLES_RETENTION_DAYS * DAY_MS)));
  return `pruned ${requests.rowCount ?? 0} OpenData request log row(s) and ${samples.rowCount ?? 0} load sample(s)`;
}

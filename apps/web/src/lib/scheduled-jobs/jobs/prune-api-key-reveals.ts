/**
 * GC-Stats - prune-api-key-reveals
 *
 * Scheduled job: deletes expired API key reveal links so the table (and its
 * encrypted key blobs) doesn't grow unbounded. Mirrors V1's
 * app:prune-api-key-reveals.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { lt } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { apiKeyReveals } from "@gc-stats/db";

/** Deletes expired API key reveal links, whether or not they were ever viewed, so the table (and its encrypted key blobs) doesn't grow unbounded. Mirrors V1's app:prune-api-key-reveals. */
export async function pruneApiKeyReveals(): Promise<string> {
  const deleted = await db.delete(apiKeyReveals).where(lt(apiKeyReveals.expiresAt, new Date())).returning({ id: apiKeyReveals.id });
  return `pruned ${deleted.length} expired API key reveal(s)`;
}

/**
 * GC-Stats - log-auto-activation
 *
 * Shared activity_log writer for the "auto-activate on schedule" jobs
 * (matches/tournaments) — logged with no user causer, since it's a system
 * action.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db } from "@gc-stats/db/client";
import { activityLog } from "@gc-stats/db";
import type { Tx } from "../bracket/repository";

/** Shared activity_log entry for the two "auto-activate on schedule" jobs (matches/tournaments) — no user causer, this is a system action. */
export async function logAutoActivation(subjectType: "match" | "tournament", subjectId: number, description: string, client: Tx = db): Promise<void> {
  await client.insert(activityLog).values({
    logName: subjectType,
    description,
    subjectType,
    subjectId: String(subjectId),
    event: `${subjectType}.auto_activated`,
    properties: { status: "live" },
  });
}

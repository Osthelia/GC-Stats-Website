/**
 * GC-Stats - flush-change-request-discord-notices
 *
 * Scheduled job: sends the debounced Discord decision notice for every
 * change request whose wait window has elapsed, see notify.ts's
 * scheduleChangeRequestDiscordNotice.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, lte } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { changeRequestDiscordNotices } from "@gc-stats/db";
import { sendChangeRequestDiscordDecision } from "@/lib/notify";

/**
 * Sends the debounced Discord decision notice for every change request whose
 * wait window has elapsed (see notify.ts's scheduleChangeRequestDiscordNotice).
 * Deletes the row before sending, conditioned on it still existing, so an
 * overlapping tick (Cloudflare Cron Triggers can overlap) can't send twice.
 */
export async function flushChangeRequestDiscordNotices(): Promise<string> {
  const due = await db.select({ changeRequestId: changeRequestDiscordNotices.changeRequestId }).from(changeRequestDiscordNotices).where(lte(changeRequestDiscordNotices.scheduledAt, new Date()));
  if (due.length === 0) return "no change request discord notice due";

  let sent = 0;
  for (const { changeRequestId } of due) {
    const claimed = await db.delete(changeRequestDiscordNotices).where(eq(changeRequestDiscordNotices.changeRequestId, changeRequestId)).returning({ changeRequestId: changeRequestDiscordNotices.changeRequestId });
    if (claimed.length === 0) continue;

    if (await sendChangeRequestDiscordDecision(changeRequestId)) sent++;
  }

  return `sent ${sent}/${due.length} change request discord notice(s)`;
}

/**
 * GC-Stats - activate-live-tournaments
 *
 * Scheduled job: flips tournaments from upcoming to live around their start
 * date and notifies Discord. Never auto-flips to finished. Mirrors V1's
 * tournaments:activate-live.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments } from "@gc-stats/db";
import { postDiscordWebhook } from "@/lib/discord-webhook";
import { logAutoActivation } from "../log-auto-activation";

const WINDOW_DAYS = 1;

/**
 * Flips a tournament from `upcoming` to `live` around its start date, and
 * notifies Discord. Tournaments are never flipped to `finished`
 * automatically, most editors can't edit a finished tournament. Mirrors
 * V1's tournaments:activate-live.
 */
export async function activateLiveTournaments(): Promise<string> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const startDateFrom = windowStart.toISOString().slice(0, 10);
  const startDateTo = windowEnd.toISOString().slice(0, 10);

  const candidates = await db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(and(eq(tournaments.status, "upcoming"), gte(tournaments.startDate, startDateFrom), lte(tournaments.startDate, startDateTo)));

  if (candidates.length === 0) return "no tournament to activate";

  let activated = 0;

  for (const tournament of candidates) {
    // Conditional on status="upcoming" so a concurrent tick can't double-activate the same tournament.
    const didActivate = await db.transaction(async (tx) => {
      const updated = await tx
        .update(tournaments)
        .set({ status: "live" })
        .where(and(eq(tournaments.id, tournament.id), eq(tournaments.status, "upcoming")))
        .returning({ id: tournaments.id });
      if (updated.length === 0) return false;

      await logAutoActivation("tournament", tournament.id, `Tournament #${tournament.id} auto-activated (live)`, tx);
      return true;
    });
    if (!didActivate) continue;

    await postDiscordWebhook(process.env.DISCORD_MATCH_LIVE_WEBHOOK_URL, `🔴 **LIVE** : ${tournament.name}`);
    activated++;
  }

  return `activated ${activated}/${candidates.length} tournament(s)`;
}

/**
 * GC-Stats - activate-live-matches
 *
 * Scheduled job: flips matches from pending to live once their scheduled
 * time hits, skipping ones still chained behind an unfinished earlier
 * match, and notifies Discord. Mirrors V1's matches:activate-live.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, ne, gte, lt, lte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matches, entrants, stageContainers, stages, tournaments } from "@gc-stats/db";
import { postDiscordWebhook } from "@/lib/discord-webhook";
import { logAutoActivation } from "../log-auto-activation";

/** Only matches scheduled within the last N minutes are eligible, so a match that's simply been sitting in the past (imported historical data, a schedule that was never updated) is never swept up. */
const ACTIVATION_WINDOW_MINUTES = 5;
/** Beyond this, a still-pending match past its activation window is treated as historical data rather than a stuck job (nothing to alert on). */
const STALE_PENDING_LOOKBACK_HOURS = 24;
/** Matches of the same tournament scheduled less than this apart are considered chained. */
const CHAIN_GAP_HOURS = 3;
/** Matches scheduled closer together than this are parallel (different brackets), never chained. */
const CHAIN_MIN_GAP_HOURS = 1;

/** Flips a match from `pending` to `live` right as its scheduled time hits, and notifies Discord. Mirrors V1's matches:activate-live. */
export async function activateLiveMatches(): Promise<string> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - ACTIVATION_WINDOW_MINUTES * 60 * 1000);

  const candidates = await db
    .select({
      id: matches.id,
      containerId: matches.containerId,
      scheduledAt: matches.scheduledAt,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
    })
    .from(matches)
    .where(
      and(
        eq(matches.status, "pending"),
        isNotNull(matches.entrantAId),
        isNotNull(matches.entrantBId),
        gte(matches.scheduledAt, windowStart),
        lte(matches.scheduledAt, now)
      )
    );

  // A match that fell out of the activation window (missed tick, downtime) never re-enters it and would stay `pending` forever unnoticed otherwise.
  const staleCutoff = new Date(now.getTime() - STALE_PENDING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const stalePending = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.status, "pending"), isNotNull(matches.entrantAId), isNotNull(matches.entrantBId), lt(matches.scheduledAt, windowStart), gte(matches.scheduledAt, staleCutoff)));
  if (stalePending.length > 0) {
    console.info(`[scheduled:activate-live-matches] ${stalePending.length} match(es) missed the activation window and are stuck pending: ${stalePending.map((m) => m.id).join(", ")}`);
  }

  if (candidates.length === 0) return "no match to activate";

  const containerIds = [...new Set(candidates.map((m) => m.containerId))];
  const containerTournaments = await db
    .select({ containerId: stageContainers.id, tournamentId: stages.tournamentId, tournamentName: tournaments.name })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(inArray(stageContainers.id, containerIds));
  const tournamentByContainer = new Map(containerTournaments.map((c) => [c.containerId, c]));

  const entrantIds = [...new Set(candidates.flatMap((m) => [m.entrantAId, m.entrantBId]).filter((id): id is number => id !== null))];
  const entrantRows = entrantIds.length ? await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, entrantIds)) : [];
  const entrantNameById = new Map(entrantRows.map((e) => [e.id, e.displayName]));

  const tournamentIds = [...new Set([...tournamentByContainer.values()].map((t) => t.tournamentId))];
  const allContainers = await db
    .select({ id: stageContainers.id, tournamentId: stages.tournamentId })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(inArray(stages.tournamentId, tournamentIds));
  const containerIdsByTournament = new Map<number, number[]>();
  for (const c of allContainers) {
    containerIdsByTournament.set(c.tournamentId, [...(containerIdsByTournament.get(c.tournamentId) ?? []), c.id]);
  }

  let activated = 0;

  for (const match of candidates) {
    if (!match.scheduledAt) continue;
    const tournament = tournamentByContainer.get(match.containerId);
    if (!tournament) continue;

    const sameTournamentContainerIds = containerIdsByTournament.get(tournament.tournamentId) ?? [];
    if (await isChainedToUnfinishedMatch(match.id, sameTournamentContainerIds, match.scheduledAt)) continue;

    // Conditional on status="pending" so a concurrent tick (Cloudflare Cron Triggers can overlap) can't double-activate the same match.
    // Update + activity log run in the same transaction so a log insert failure never leaves a match "live" without an audit trail.
    const didActivate = await db.transaction(async (tx) => {
      const updated = await tx
        .update(matches)
        .set({ status: "live" })
        .where(and(eq(matches.id, match.id), eq(matches.status, "pending")))
        .returning({ id: matches.id });
      if (updated.length === 0) return false;

      await logAutoActivation("match", match.id, `Match #${match.id} auto-activated (live)`, tx);
      return true;
    });
    if (!didActivate) continue;

    const entrantAName = match.entrantAId !== null ? (entrantNameById.get(match.entrantAId) ?? "TBD") : "TBD";
    const entrantBName = match.entrantBId !== null ? (entrantNameById.get(match.entrantBId) ?? "TBD") : "TBD";
    await postDiscordWebhook(process.env.DISCORD_MATCH_LIVE_WEBHOOK_URL, `🔴 **LIVE** : ${entrantAName} vs ${entrantBName}\n${tournament.tournamentName}`);

    activated++;
  }

  return `activated ${activated}/${candidates.length} match(es)`;
}

/** True when a match of the same tournament, scheduled shortly before this one, hasn't wrapped up yet. */
async function isChainedToUnfinishedMatch(matchId: number, sameTournamentContainerIds: number[], scheduledAt: Date): Promise<boolean> {
  if (sameTournamentContainerIds.length === 0) return false;

  const chainWindowStart = new Date(scheduledAt.getTime() - CHAIN_GAP_HOURS * 60 * 60 * 1000);
  const chainWindowEnd = new Date(scheduledAt.getTime() - CHAIN_MIN_GAP_HOURS * 60 * 60 * 1000);

  const blocking = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        inArray(matches.containerId, sameTournamentContainerIds),
        ne(matches.id, matchId),
        ne(matches.status, "completed"),
        gte(matches.scheduledAt, chainWindowStart),
        lte(matches.scheduledAt, chainWindowEnd)
      )
    )
    .limit(1);

  return blocking.length > 0;
}

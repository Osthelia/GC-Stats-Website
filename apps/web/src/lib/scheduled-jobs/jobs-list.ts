/**
 * GC-Stats - jobs-list
 *
 * Registry of all scheduled jobs (cron expression + run function) and the
 * dispatcher that runs the jobs due for a given cron tick. Imported
 * directly by the Cloudflare Workers cron route, so it must stay free of
 * node-cron (that import crashes Workers at startup).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pruneApiKeyReveals } from "./jobs/prune-api-key-reveals";
import { pruneRateLimitCounters } from "./jobs/prune-rate-limit-counters";
import { resetDataExplorerUsage } from "./jobs/reset-data-explorer-usage";
import { pruneDataExplorerErrorLogs } from "./jobs/prune-data-explorer-error-logs";
import { prunePageViews } from "./jobs/prune-page-views";
import { activateLiveMatches } from "./jobs/activate-live-matches";
import { activateLiveTournaments } from "./jobs/activate-live-tournaments";
import { detectPlayerPovStreams } from "./jobs/detect-player-pov-streams";
import { pruneExpiredOAuthTokens } from "./jobs/prune-expired-oauth-tokens";
import { flushChangeRequestDiscordNotices } from "./jobs/flush-change-request-discord-notices";
import { deactivateInactiveEntities } from "./jobs/deactivate-inactive-entities";

/** `workersPaused`: skipped on Cloudflare Workers only (Free plan 10ms CPU per tick), still run by the Docker scheduler. */
export type ScheduledJob = { name: string; cron: string; run: () => Promise<string>; workersPaused?: boolean };

/** A job summary reporting zero effective work (nothing activated/recorded), so the per-minute jobs don't flood logs with a line every tick. */
export function isNoopSummary(summary: string): boolean {
  return summary.startsWith("no ") || /^activated 0\//.test(summary) || /recorded\/updated 0 POV stream/.test(summary) || /^sent 0\//.test(summary);
}

// No node-cron import here on purpose: apps/web/src/app/api/internal/cron/route.ts
// (Cloudflare Workers) imports runJobsForCron from this file directly. node-cron
// itself crashes at Worker startup just by being imported (its
// background-scheduled-task.ts calls fileURLToPath(import.meta.url) at module
// scope, which workerd doesn't support) — registry.ts (Docker only) is the
// only file allowed to import node-cron.
export const jobs: ScheduledJob[] = [
  { name: "prune-api-key-reveals", cron: "*/15 * * * *", run: pruneApiKeyReveals },
  { name: "prune-rate-limit-counters", cron: "*/15 * * * *", run: pruneRateLimitCounters },
  { name: "reset-data-explorer-usage", cron: "5 0 1 * *", run: resetDataExplorerUsage },
  { name: "prune-data-explorer-error-logs", cron: "0 0 * * *", run: pruneDataExplorerErrorLogs },
  { name: "prune-page-views", cron: "0 0 * * *", run: prunePageViews },
  { name: "activate-live-matches", cron: "* * * * *", run: activateLiveMatches },
  { name: "activate-live-tournaments", cron: "0 0 * * *", run: activateLiveTournaments },
  { name: "detect-player-pov-streams", cron: "* * * * *", run: detectPlayerPovStreams, workersPaused: true },
  { name: "prune-expired-oauth-tokens", cron: "*/15 * * * *", run: pruneExpiredOAuthTokens },
  { name: "flush-change-request-discord-notices", cron: "* * * * *", run: flushChangeRequestDiscordNotices, workersPaused: true },
  { name: "deactivate-inactive-entities", cron: "10 0 1 * *", run: deactivateInactiveEntities },
];

/** Runs every job matching this cron expression, sequentially, swallowing individual failures. Used by the Workers scheduled() dispatcher. */
export async function runJobsForCron(cronExpr: string): Promise<void> {
  for (const job of jobs.filter((j) => j.cron === cronExpr && !j.workersPaused)) {
    try {
      const summary = await job.run();
      if (!isNoopSummary(summary)) console.log(`[scheduled:${job.name}] ${summary}`);
    } catch (error) {
      console.error(`[scheduled:${job.name}] failed`, error);
    }
  }
}

/**
 * GC-Stats - registry
 *
 * Starts the in-process node-cron scheduler for the self-hosted Docker
 * deploy only. Cloudflare Workers dispatch the same jobs via Cron Triggers
 * instead (see jobs-list.ts), since node-cron cannot even be imported there.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import cron from "node-cron";
import { jobs, isNoopSummary } from "./jobs-list";

let started = false;

/** Starts the in-process scheduler once per server (single long-lived Node process, self-hosted Docker deploy only — see instrumentation.ts). Not used on Cloudflare Workers, which dispatch these jobs via Cron Triggers instead (see custom-worker.ts / jobs-list.ts). */
export function startScheduledJobs(): void {
  if (started) return;
  started = true;

  for (const job of jobs) {
    let isRunning = false;

    cron.schedule(job.cron, async () => {
      if (isRunning) {
        console.warn(`[scheduled:${job.name}] previous run still in progress, skipping tick`);
        return;
      }

      isRunning = true;
      try {
        const summary = await job.run();
        if (!isNoopSummary(summary)) console.log(`[scheduled:${job.name}] ${summary}`);
      } catch (error) {
        console.error(`[scheduled:${job.name}] failed`, error);
      } finally {
        isRunning = false;
      }
    });

    console.log(`[scheduled:${job.name}] registered (${job.cron})`);
  }
}

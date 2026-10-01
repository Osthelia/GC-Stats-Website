/**
 * GC-Stats - Next.js instrumentation
 *
 * Next.js instrumentation hook, runs once per server process on boot.
 * Starts the in-process cron scheduler (see lib/scheduled-jobs/registry.ts)
 * for the self-hosted Docker deploy (single long-lived Node process, no
 * external cron trigger available there). Skipped on Cloudflare Workers
 * (DEPLOY_TARGET=cloudflare, set in wrangler.jsonc), which has no long-lived
 * process, those same jobs run via Cron Triggers instead (custom-worker.ts).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DEPLOY_TARGET !== "cloudflare") {
    const { startScheduledJobs } = await import("@/lib/scheduled-jobs/registry");
    startScheduledJobs();
  }
}

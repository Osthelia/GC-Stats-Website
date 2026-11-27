/**
 * GC-Stats - Next.js instrumentation
 *
 * Next.js instrumentation hook, runs once per server process on boot.
 * Starts the in-process cron scheduler (see lib/scheduled-jobs/registry.ts)
 * only when ENABLE_IN_PROCESS_SCHEDULER=true (local dev, single process). In the
 * cluster it stays off: every replica would run each job, so Kubernetes CronJobs
 * call POST /api/internal/cron instead.
 * Server errors are reported through the Sentry SDK when SENTRY_DSN is set.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import * as Sentry from "@sentry/nextjs";
import { parseSampleRate, sentryOptions } from "@/lib/monitoring/sentry-options";

export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    Sentry.init(
      sentryOptions({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT,
        tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
      }),
    );
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Per process load sample of the OpenData monitoring, unlike the cron jobs every replica runs it.
    const { startOpenDataSampler } = await import("@/lib/opendata/metrics");
    startOpenDataSampler();
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.ENABLE_IN_PROCESS_SCHEDULER === "true") {
    const { startScheduledJobs } = await import("@/lib/scheduled-jobs/registry");
    startScheduledJobs();
  }
}

/**
 * GC-Stats - cron-monitor
 *
 * Sentry cron monitors, one per cron expression (one Kubernetes CronJob each).
 * A run that is missed, fails or lasts too long opens an issue. Opt-in through
 * SENTRY_CRON_MONITORS=true, so environments with suspended CronJobs stay quiet.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import * as Sentry from "@sentry/nextjs";

type CronMonitor = {
  slug: string;
  /** Minutes a check-in may be late before the run counts as missed. */
  checkinMargin: number;
  /** Minutes before a run still in progress counts as failed. */
  maxRuntime: number;
  /** Consecutive bad runs before an issue is opened. */
  failureIssueThreshold: number;
};

export const cronMonitors: Record<string, CronMonitor> = {
  // A single tick lost to a pod restart is caught up by the next one.
  "* * * * *": { slug: "gcs-cron-every-minute", checkinMargin: 2, maxRuntime: 2, failureIssueThreshold: 3 },
  "*/15 * * * *": { slug: "gcs-cron-every-15-minutes", checkinMargin: 5, maxRuntime: 5, failureIssueThreshold: 2 },
  "0 0 * * *": { slug: "gcs-cron-daily", checkinMargin: 10, maxRuntime: 10, failureIssueThreshold: 1 },
  "0 6 * * *": { slug: "gcs-cron-daily-roster-watch", checkinMargin: 10, maxRuntime: 15, failureIssueThreshold: 1 },
  "5 0 1 * *": { slug: "gcs-cron-monthly-reset", checkinMargin: 10, maxRuntime: 10, failureIssueThreshold: 1 },
  "10 0 1 * *": { slug: "gcs-cron-monthly-deactivate", checkinMargin: 10, maxRuntime: 10, failureIssueThreshold: 1 },
};

/** Opens the check-in of a run and returns the function closing it. Does nothing when monitoring is off. */
export function startCronCheckIn(cronExpr: string): (status: "ok" | "error") => void {
  const monitor = process.env.SENTRY_CRON_MONITORS === "true" ? cronMonitors[cronExpr] : undefined;
  if (!monitor) return () => {};

  const { slug: monitorSlug, ...config } = monitor;
  const startedAt = Date.now();
  const checkInId = Sentry.captureCheckIn(
    { monitorSlug, status: "in_progress" },
    { schedule: { type: "crontab", value: cronExpr }, timezone: "Etc/UTC", recoveryThreshold: 1, ...config },
  );

  return (status) => {
    Sentry.captureCheckIn({ checkInId, monitorSlug, status, duration: (Date.now() - startedAt) / 1000 });
  };
}

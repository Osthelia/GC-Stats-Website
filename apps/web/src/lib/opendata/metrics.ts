/**
 * GC-Stats - opendata metrics
 *
 * OpenData monitoring writes: request log rows buffered and inserted in
 * batches, one load sample per process and minute, and a Discord alert when
 * the portal had to be throttled or shed to protect the site. Every write
 * goes through the OpenData pool.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { openDataDb } from "@gc-stats/db/client";
import { opendataRequestLog, opendataPressureSamples } from "@gc-stats/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { postDiscordWebhook } from "@/lib/discord-webhook";
import { pressureSnapshot, takePressureWindow, type PressureLevel } from "./pressure";
import type { OpenDataDataset, OpenDataRequestKind } from "./datasets-meta";

export type OpenDataOutcome = "ok" | "rate_limited" | "shed" | "auth_required" | "disabled" | "bad_request" | "error";

export type OpenDataRequestEntry = {
  dataset: OpenDataDataset;
  kind: OpenDataRequestKind;
  outcome: OpenDataOutcome;
  statusCode: number;
  durationMs: number;
  queueMs: number;
  cacheHit: boolean;
  rowCount: number;
  userId: string | null;
  clientHash: string;
  pressure: PressureLevel;
};

const FLUSH_DELAY_MS = 5_000;
const FLUSH_SIZE = 200;
// Failed batches are kept for the next flush, oldest rows dropped past this cap.
const MAX_BUFFER = 5_000;
const SAMPLE_INTERVAL_MS = 60_000;
const ALERT_COOLDOWN_MS = 30 * 60_000;
// Elevated this many minutes in a row is alerted even without shed requests.
const ELEVATED_STREAK_ALERT = 5;

type MetricsState = {
  buffer: (typeof opendataRequestLog.$inferInsert)[];
  flushTimer: NodeJS.Timeout | null;
  flushing: boolean;
  samplerStarted: boolean;
  minuteRequests: number;
  minuteShed: number;
  elevatedStreak: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __gcsOpenDataMetrics: MetricsState | undefined;
}

function state(): MetricsState {
  globalThis.__gcsOpenDataMetrics ??= {
    buffer: [],
    flushTimer: null,
    flushing: false,
    samplerStarted: false,
    minuteRequests: 0,
    minuteShed: 0,
    elevatedStreak: 0,
  };
  return globalThis.__gcsOpenDataMetrics;
}

/** Short keyed hash of the client IP: groups a client's requests without storing its address. */
export function hashClient(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? ""}:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

function scheduleFlush(): void {
  const s = state();
  if (!s.flushTimer) s.flushTimer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
}

async function flush(): Promise<void> {
  const s = state();
  if (s.flushTimer) clearTimeout(s.flushTimer);
  s.flushTimer = null;
  if (s.flushing) return;
  const batch = s.buffer.splice(0, FLUSH_SIZE);
  if (batch.length === 0) return;

  s.flushing = true;
  try {
    await openDataDb.insert(opendataRequestLog).values(batch);
  } catch (error) {
    console.error("[opendata] request log write failed (%d rows)", batch.length, error);
    s.buffer.unshift(...batch);
    if (s.buffer.length > MAX_BUFFER) s.buffer.splice(0, s.buffer.length - MAX_BUFFER);
  } finally {
    s.flushing = false;
  }
  if (s.buffer.length > 0) scheduleFlush();
}

export function recordOpenDataRequest(entry: OpenDataRequestEntry): void {
  const s = state();
  s.minuteRequests += 1;
  if (entry.outcome === "shed") s.minuteShed += 1;

  if (s.buffer.length >= MAX_BUFFER) s.buffer.shift();
  s.buffer.push(entry);

  if (s.buffer.length >= FLUSH_SIZE && !s.flushing) void flush();
  else scheduleFlush();
}

async function maybeAlert(level: PressureLevel, maxLagMs: number, shed: number, requests: number, instance: string): Promise<void> {
  const s = state();
  s.elevatedStreak = level === "normal" ? 0 : s.elevatedStreak + 1;
  const shouldAlert = level === "critical" || shed > 0 || s.elevatedStreak >= ELEVATED_STREAK_ALERT;
  const webhook = process.env.DISCORD_OPENDATA_ALERT_WEBHOOK_URL;
  if (!shouldAlert || !webhook) return;

  // Shared counter: one alert per cooldown across every replica.
  if (!(await checkRateLimit("opendata:alert", ALERT_COOLDOWN_MS, 1, 1, openDataDb))) return;

  const siteUrl = process.env.SITE_URL ?? "";
  await postDiscordWebhook(
    webhook,
    [
      `:warning: **OpenData under pressure** (${level}) on \`${instance}\``,
      `Event loop lag p99: ${maxLagMs} ms, OpenData requests last minute: ${requests}, shed: ${shed}`,
      `The site keeps priority: OpenData is throttled until load goes back down.`,
      siteUrl ? `${siteUrl}/en/admin/settings/opendata` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function takeSample(instance: string): Promise<void> {
  const s = state();
  const { maxLagMs, worstLevel } = takePressureWindow();
  const snapshot = pressureSnapshot();
  const requests = s.minuteRequests;
  const shed = s.minuteShed;
  s.minuteRequests = 0;
  s.minuteShed = 0;

  try {
    await openDataDb.insert(opendataPressureSamples).values({
      instance,
      pressure: worstLevel,
      eventLoopLagMs: maxLagMs,
      dbPoolTotal: snapshot.dbPool.total,
      dbPoolWaiting: snapshot.dbPool.waiting,
      inFlight: snapshot.inFlight,
      queued: snapshot.queued,
    });
  } catch (error) {
    console.error("[opendata] pressure sample write failed", error);
  }

  await maybeAlert(worstLevel, maxLagMs, shed, requests, instance);
}

/** Started once per server process from instrumentation.ts. */
export function startOpenDataSampler(): void {
  const s = state();
  if (s.samplerStarted) return;
  s.samplerStarted = true;
  const instance = process.env.HOSTNAME || hostname();
  setInterval(() => void takeSample(instance), SAMPLE_INTERVAL_MS).unref();
}

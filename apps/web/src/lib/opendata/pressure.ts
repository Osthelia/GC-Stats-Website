/**
 * GC-Stats - opendata pressure
 *
 * Keeps the site first: watches this process' load (event loop lag, site
 * queries waiting for a database connection) and admits OpenData queries
 * through a small concurrency gate that tightens, then closes, as load rises.
 * Cached responses are still served while the gate is closed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { monitorEventLoopDelay, type ELDHistogram } from "node:perf_hooks";
import { getDbPoolStats } from "@gc-stats/db/client";

export type PressureLevel = "normal" | "elevated" | "critical";

export const PRESSURE_LEVELS: PressureLevel[] = ["normal", "elevated", "critical"];

export const PRESSURE_THRESHOLDS = {
  elevatedLagMs: 80,
  criticalLagMs: 250,
  elevatedPoolWaiting: 1,
  criticalPoolWaiting: 5,
} as const;

/** OpenData queries allowed at once in this process, per level. */
export const MAX_CONCURRENT: Record<PressureLevel, number> = { normal: 2, elevated: 1, critical: 0 };
const MAX_QUEUE = 20;
const QUEUE_TIMEOUT_MS = 10_000;
const TICK_MS = 2_000;
// A level stays raised this long after its last trigger, so the gate does not flap.
const HOLD_MS = 30_000;

type Waiter = { enqueuedAt: number; resolve: (slot: OpenDataSlot | null) => void; timer: NodeJS.Timeout };

export type OpenDataSlot = { queueMs: number; release: () => void };

type PressureState = {
  histogram: ELDHistogram;
  lagMs: number;
  /** Worst values since the last sample, read and reset by metrics.ts. */
  windowMaxLagMs: number;
  windowWorstLevel: PressureLevel;
  elevatedUntil: number;
  criticalUntil: number;
  inFlight: number;
  queue: Waiter[];
};

declare global {
  // eslint-disable-next-line no-var
  var __gcsOpenDataPressure: PressureState | undefined;
}

function rank(level: PressureLevel): number {
  return PRESSURE_LEVELS.indexOf(level);
}

export function worstLevel(a: PressureLevel, b: PressureLevel): PressureLevel {
  return rank(a) >= rank(b) ? a : b;
}

function state(): PressureState {
  if (globalThis.__gcsOpenDataPressure) return globalThis.__gcsOpenDataPressure;

  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  const created: PressureState = {
    histogram,
    lagMs: 0,
    windowMaxLagMs: 0,
    windowWorstLevel: "normal",
    elevatedUntil: 0,
    criticalUntil: 0,
    inFlight: 0,
    queue: [],
  };
  globalThis.__gcsOpenDataPressure = created;

  setInterval(() => {
    // Histogram values are in nanoseconds.
    created.lagMs = Math.round(histogram.percentile(99) / 1e6);
    histogram.reset();
    created.windowMaxLagMs = Math.max(created.windowMaxLagMs, created.lagMs);
    pump();
  }, TICK_MS).unref();

  return created;
}

export function currentPressure(): PressureLevel {
  const s = state();
  const now = Date.now();
  const pool = getDbPoolStats();

  if (s.lagMs >= PRESSURE_THRESHOLDS.criticalLagMs || pool.waiting >= PRESSURE_THRESHOLDS.criticalPoolWaiting) s.criticalUntil = now + HOLD_MS;
  else if (s.lagMs >= PRESSURE_THRESHOLDS.elevatedLagMs || pool.waiting >= PRESSURE_THRESHOLDS.elevatedPoolWaiting) s.elevatedUntil = now + HOLD_MS;

  const level: PressureLevel = s.criticalUntil > now ? "critical" : s.elevatedUntil > now ? "elevated" : "normal";
  s.windowWorstLevel = worstLevel(s.windowWorstLevel, level);
  return level;
}

function pump(): void {
  const s = state();
  const max = MAX_CONCURRENT[currentPressure()];
  if (max === 0) {
    for (const waiter of s.queue.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    return;
  }
  while (s.queue.length > 0 && s.inFlight < max) {
    const waiter = s.queue.shift()!;
    clearTimeout(waiter.timer);
    waiter.resolve(grant(Date.now() - waiter.enqueuedAt));
  }
}

function grant(queueMs: number): OpenDataSlot {
  const s = state();
  s.inFlight += 1;
  let released = false;
  return {
    queueMs,
    release: () => {
      if (released) return;
      released = true;
      s.inFlight -= 1;
      pump();
    },
  };
}

/** Waits for a query slot. `null` means the request is shed: the site needs the capacity. */
export function acquireSlot(): Promise<OpenDataSlot | null> {
  const s = state();
  const max = MAX_CONCURRENT[currentPressure()];
  if (max === 0) return Promise.resolve(null);
  if (s.inFlight < max && s.queue.length === 0) return Promise.resolve(grant(0));
  if (s.queue.length >= MAX_QUEUE) return Promise.resolve(null);

  return new Promise((resolve) => {
    const waiter: Waiter = {
      enqueuedAt: Date.now(),
      resolve,
      timer: setTimeout(() => {
        s.queue = s.queue.filter((w) => w !== waiter);
        resolve(null);
      }, QUEUE_TIMEOUT_MS),
    };
    s.queue.push(waiter);
  });
}

export type PressureSnapshot = {
  level: PressureLevel;
  lagMs: number;
  inFlight: number;
  queued: number;
  dbPool: ReturnType<typeof getDbPoolStats>;
};

export function pressureSnapshot(): PressureSnapshot {
  const s = state();
  return { level: currentPressure(), lagMs: s.lagMs, inFlight: s.inFlight, queued: s.queue.length, dbPool: getDbPoolStats() };
}

/** Worst lag and level since the previous call, then starts a new window. */
export function takePressureWindow(): { maxLagMs: number; worstLevel: PressureLevel } {
  const s = state();
  const level = worstLevel(s.windowWorstLevel, currentPressure());
  const result = { maxLagMs: Math.max(s.windowMaxLagMs, s.lagMs), worstLevel: level };
  s.windowMaxLagMs = 0;
  s.windowWorstLevel = "normal";
  return result;
}

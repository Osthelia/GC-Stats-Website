/**
 * GC-Stats - opendata monitoring
 *
 * Read side of /admin/settings/opendata: usage totals, request and load
 * timelines, per dataset breakdown, top consumers, and a verdict telling
 * whether the portal is getting too demanding for the site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { PRESSURE_THRESHOLDS, type PressureLevel } from "./pressure";
import type { OpenDataDataset, OpenDataRequestKind } from "./datasets-meta";

export const MONITORING_RANGES = ["1h", "24h", "7d"] as const;
export type MonitoringRange = (typeof MONITORING_RANGES)[number];

const RANGE_CONFIG: Record<MonitoringRange, { intervalMs: number; bucketMs: number }> = {
  "1h": { intervalMs: 60 * 60_000, bucketMs: 2 * 60_000 },
  "24h": { intervalMs: 24 * 60 * 60_000, bucketMs: 30 * 60_000 },
  "7d": { intervalMs: 7 * 24 * 60 * 60_000, bucketMs: 4 * 60 * 60_000 },
};

// Verdict thresholds over the selected range.
const STRAINED_ELEVATED_SHARE = 0.05;
const STRAINED_LIMITED_SHARE = 0.2;
const STRAINED_P95_MS = 3_000;

export type MonitoringSummary = {
  requests: number;
  clients: number;
  served: number;
  exports: number;
  cacheHitRate: number;
  p95Ms: number;
  avgQueueMs: number;
  rateLimited: number;
  shed: number;
  errors: number;
  authRequired: number;
  rowsServed: number;
};

export type RequestBucket = { at: string; served: number; rateLimited: number; shed: number; errors: number };
export type PressureBucket = { at: string; lagMs: number; poolWaiting: number; inFlight: number; level: PressureLevel };

export type DatasetUsage = {
  dataset: OpenDataDataset;
  kind: OpenDataRequestKind;
  requests: number;
  served: number;
  cacheHitRate: number;
  avgMs: number;
  p95Ms: number;
  rows: number;
};

export type ConsumerUsage = {
  key: string;
  userId: string | null;
  username: string | null;
  requests: number;
  exports: number;
  rateLimited: number;
  shed: number;
  lastSeen: string;
};

export type InstanceStatus = { instance: string; level: PressureLevel; lagMs: number; poolWaiting: number; inFlight: number; queued: number; sampledAt: string };

export type MonitoringVerdict = { level: "healthy" | "strained" | "overloaded"; reasons: string[] };

export type MonitoringData = {
  range: MonitoringRange;
  summary: MonitoringSummary;
  requestTimeline: RequestBucket[];
  pressureTimeline: PressureBucket[];
  datasets: DatasetUsage[];
  consumers: ConsumerUsage[];
  instances: InstanceStatus[];
  samplesTotal: number;
  samplesElevated: number;
  samplesCritical: number;
  verdict: MonitoringVerdict;
  thresholds: typeof PRESSURE_THRESHOLDS;
};

const num = (v: unknown) => Number(v ?? 0);

// Starts at the bucket holding `since`, so the charts cover the same rows as the summary.
function bucketStarts(range: MonitoringRange, since: number): number[] {
  const { bucketMs } = RANGE_CONFIG[range];
  const end = Math.floor(Date.now() / bucketMs) * bucketMs;
  const starts: number[] = [];
  for (let at = Math.floor(since / bucketMs) * bucketMs; at <= end; at += bucketMs) starts.push(at);
  return starts;
}

const RANK_LEVEL: PressureLevel[] = ["normal", "elevated", "critical"];

export async function getOpenDataMonitoring(range: MonitoringRange): Promise<MonitoringData> {
  const { intervalMs, bucketMs } = RANGE_CONFIG[range];
  const sinceMs = Date.now() - intervalMs;
  const since = new Date(sinceMs).toISOString();
  const bucket = (column: string) => sql.raw(`(floor(extract(epoch from ${column}) * 1000 / ${bucketMs}) * ${bucketMs})::bigint`);

  const [summaryRes, timelineRes, pressureRes, datasetsRes, consumersRes, instancesRes, samplesRes] = await Promise.all([
    db.execute(sql`
      select
        count(*)::int as requests,
        count(distinct coalesce(user_id, client_hash))::int as clients,
        count(*) filter (where outcome = 'ok')::int as served,
        count(*) filter (where outcome = 'ok' and kind = 'export')::int as exports,
        coalesce(avg(case when cache_hit then 1.0 else 0.0 end) filter (where outcome = 'ok'), 0)::float as cache_hit_rate,
        coalesce(percentile_cont(0.95) within group (order by duration_ms) filter (where outcome = 'ok'), 0)::float as p95_ms,
        coalesce(avg(queue_ms) filter (where outcome = 'ok'), 0)::float as avg_queue_ms,
        count(*) filter (where outcome = 'rate_limited')::int as rate_limited,
        count(*) filter (where outcome = 'shed')::int as shed,
        count(*) filter (where outcome = 'error')::int as errors,
        count(*) filter (where outcome = 'auth_required')::int as auth_required,
        coalesce(sum(row_count), 0)::bigint as rows_served
      from opendata_request_log
      where created_at >= ${since}`),
    db.execute(sql`
      select ${bucket("created_at")} as at,
        count(*) filter (where outcome = 'ok')::int as served,
        count(*) filter (where outcome = 'rate_limited')::int as rate_limited,
        count(*) filter (where outcome = 'shed')::int as shed,
        count(*) filter (where outcome = 'error')::int as errors
      from opendata_request_log
      where created_at >= ${since}
      group by 1`),
    db.execute(sql`
      select ${bucket("sampled_at")} as at,
        max(event_loop_lag_ms)::int as lag_ms,
        max(db_pool_waiting)::int as pool_waiting,
        max(in_flight)::int as in_flight,
        max(case pressure when 'critical' then 2 when 'elevated' then 1 else 0 end)::int as level_rank
      from opendata_pressure_samples
      where sampled_at >= ${since}
      group by 1`),
    db.execute(sql`
      select dataset, kind,
        count(*)::int as requests,
        count(*) filter (where outcome = 'ok')::int as served,
        coalesce(avg(case when cache_hit then 1.0 else 0.0 end) filter (where outcome = 'ok'), 0)::float as cache_hit_rate,
        coalesce(avg(duration_ms) filter (where outcome = 'ok'), 0)::float as avg_ms,
        coalesce(percentile_cont(0.95) within group (order by duration_ms) filter (where outcome = 'ok'), 0)::float as p95_ms,
        coalesce(sum(row_count), 0)::bigint as rows
      from opendata_request_log
      where created_at >= ${since}
      group by dataset, kind
      order by requests desc`),
    db.execute(sql`
      select coalesce(l.user_id, l.client_hash) as key,
        max(l.user_id) as user_id,
        max(u.username) as username,
        count(*)::int as requests,
        count(*) filter (where l.kind = 'export' and l.outcome = 'ok')::int as exports,
        count(*) filter (where l.outcome = 'rate_limited')::int as rate_limited,
        count(*) filter (where l.outcome = 'shed')::int as shed,
        max(l.created_at) as last_seen
      from opendata_request_log l
      left join users u on u.id = l.user_id
      where l.created_at >= ${since}
      group by 1
      order by requests desc
      limit 20`),
    db.execute(sql`
      select distinct on (instance) instance, pressure, event_loop_lag_ms, db_pool_waiting, in_flight, queued, sampled_at
      from opendata_pressure_samples
      where sampled_at >= now() - interval '3 minutes'
      order by instance, sampled_at desc`),
    db.execute(sql`
      select count(*)::int as total,
        count(*) filter (where pressure = 'elevated')::int as elevated,
        count(*) filter (where pressure = 'critical')::int as critical
      from opendata_pressure_samples
      where sampled_at >= ${since}`),
  ]);

  const s = summaryRes.rows[0] ?? {};
  const summary: MonitoringSummary = {
    requests: num(s.requests),
    clients: num(s.clients),
    served: num(s.served),
    exports: num(s.exports),
    cacheHitRate: num(s.cache_hit_rate),
    p95Ms: Math.round(num(s.p95_ms)),
    avgQueueMs: Math.round(num(s.avg_queue_ms)),
    rateLimited: num(s.rate_limited),
    shed: num(s.shed),
    errors: num(s.errors),
    authRequired: num(s.auth_required),
    rowsServed: num(s.rows_served),
  };

  const timelineByBucket = new Map(timelineRes.rows.map((r) => [num(r.at), r]));
  const pressureByBucket = new Map(pressureRes.rows.map((r) => [num(r.at), r]));
  const starts = bucketStarts(range, sinceMs);

  const requestTimeline: RequestBucket[] = starts.map((at) => {
    const r = timelineByBucket.get(at);
    return { at: new Date(at).toISOString(), served: num(r?.served), rateLimited: num(r?.rate_limited), shed: num(r?.shed), errors: num(r?.errors) };
  });
  const pressureTimeline: PressureBucket[] = starts.map((at) => {
    const r = pressureByBucket.get(at);
    return {
      at: new Date(at).toISOString(),
      lagMs: num(r?.lag_ms),
      poolWaiting: num(r?.pool_waiting),
      inFlight: num(r?.in_flight),
      level: RANK_LEVEL[num(r?.level_rank)] ?? "normal",
    };
  });

  const datasets: DatasetUsage[] = datasetsRes.rows.map((r) => ({
    dataset: r.dataset as OpenDataDataset,
    kind: r.kind as OpenDataRequestKind,
    requests: num(r.requests),
    served: num(r.served),
    cacheHitRate: num(r.cache_hit_rate),
    avgMs: Math.round(num(r.avg_ms)),
    p95Ms: Math.round(num(r.p95_ms)),
    rows: num(r.rows),
  }));

  const consumers: ConsumerUsage[] = consumersRes.rows.map((r) => ({
    key: String(r.key),
    userId: (r.user_id as string | null) ?? null,
    username: (r.username as string | null) ?? null,
    requests: num(r.requests),
    exports: num(r.exports),
    rateLimited: num(r.rate_limited),
    shed: num(r.shed),
    lastSeen: new Date(r.last_seen as string).toISOString(),
  }));

  const instances: InstanceStatus[] = instancesRes.rows.map((r) => ({
    instance: String(r.instance),
    level: r.pressure as PressureLevel,
    lagMs: num(r.event_loop_lag_ms),
    poolWaiting: num(r.db_pool_waiting),
    inFlight: num(r.in_flight),
    queued: num(r.queued),
    sampledAt: new Date(r.sampled_at as string).toISOString(),
  }));

  const samples = samplesRes.rows[0] ?? {};
  const samplesTotal = num(samples.total);
  const samplesElevated = num(samples.elevated);
  const samplesCritical = num(samples.critical);

  return {
    range,
    summary,
    requestTimeline,
    pressureTimeline,
    datasets,
    consumers,
    instances,
    samplesTotal,
    samplesElevated,
    samplesCritical,
    verdict: computeVerdict(summary, samplesTotal, samplesElevated, samplesCritical),
    thresholds: PRESSURE_THRESHOLDS,
  };
}

/** Reasons are i18n keys under admin.opendataMonitoring.reasons. */
function computeVerdict(summary: MonitoringSummary, samplesTotal: number, samplesElevated: number, samplesCritical: number): MonitoringVerdict {
  const reasons: string[] = [];
  let level: MonitoringVerdict["level"] = "healthy";
  const raise = (to: MonitoringVerdict["level"]) => {
    if (to === "overloaded" || level === "healthy") level = to;
  };

  if (summary.shed > 0) {
    raise("overloaded");
    reasons.push("shed");
  }
  if (samplesCritical > 0) {
    raise("overloaded");
    reasons.push("critical");
  }
  const raisedShare = samplesTotal > 0 ? (samplesElevated + samplesCritical) / samplesTotal : 0;
  if (raisedShare >= STRAINED_ELEVATED_SHARE) {
    raise("strained");
    reasons.push("elevated");
  }
  if (summary.requests > 0 && summary.rateLimited / summary.requests >= STRAINED_LIMITED_SHARE) {
    raise("strained");
    reasons.push("rateLimited");
  }
  if (summary.p95Ms >= STRAINED_P95_MS) {
    raise("strained");
    reasons.push("slow");
  }
  return { level, reasons };
}

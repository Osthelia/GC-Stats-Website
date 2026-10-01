/**
 * GC-Stats - api-key-stats
 *
 * Computes API key usage stats (overview summary, volume, latency
 * percentiles, daily chart, per-endpoint breakdown) shared by
 * /admin/api-keys and /dashboard/{id}/api-keys.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { apiRequestLog } from "@gc-stats/db";

export type ApiKeysOverview = {
  activeKeys: number;
  requestsThisMonth: number;
  avgResponseMs: number;
  errorRatePercent: number;
};

/**
 * "Developer dashboard" summary for a set of active key ids — mirrors V1's
 * Developers\DashboardController. Shared by /admin/api-keys (all keys) and
 * /dashboard/{id}/api-keys (one organization's keys), which each resolve
 * their own `activeKeyIds` before calling this.
 */
export async function getApiKeysOverview(activeKeyIds: number[]): Promise<ApiKeysOverview> {
  const activeKeys = activeKeyIds.length;
  if (activeKeys === 0) return { activeKeys: 0, requestsThisMonth: 0, avgResponseMs: 0, errorRatePercent: 0 };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      errors: sql<number>`count(*) filter (where ${apiRequestLog.statusCode} >= 400)`,
      avgDuration: sql<number>`coalesce(avg(${apiRequestLog.durationMs}), 0)`,
    })
    .from(apiRequestLog)
    .where(and(inArray(apiRequestLog.apiKeyId, activeKeyIds), gte(apiRequestLog.createdAt, startOfMonth)));

  const total = Number(row?.total ?? 0);
  const errors = Number(row?.errors ?? 0);

  return {
    activeKeys,
    requestsThisMonth: total,
    avgResponseMs: Math.round(Number(row?.avgDuration ?? 0)),
    errorRatePercent: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
  };
}

export type ApiKeyStats = {
  volume: { day: number; week: number; month: number };
  latency: { min: number; max: number; p50: number; p95: number; p99: number };
  daily: { labels: string[]; requests: number[]; errors: number[] };
  endpoints: { endpoint: string; requests: number; avgDurationMs: number; errorRatePercent: number }[];
};

/**
 * Same shape as V1's Developers\StatsController: trailing volume windows, a
 * response-time distribution, a 30-day daily chart, and a per-endpoint
 * breakdown — computed here with Postgres `percentile_cont` rather than
 * pulling every duration into JS to compute percentiles by hand. Shared by
 * /admin/api-keys and /dashboard/{id}/api-keys, a key's usage isn't tied to
 * which side is looking at it.
 */
export async function getApiKeyStats(apiKeyId: number): Promise<ApiKeyStats> {
  const now = new Date();
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since30d = new Date(startOfTodayUtc.getTime() - 29 * 86_400_000);
  const since24h = new Date(now.getTime() - 86_400_000);
  const since7d = new Date(now.getTime() - 7 * 86_400_000);
  // UTC bucketing — matches `since30d`/the daily-label loop below, both built from Date.UTC.
  const dateExpr = sql<string>`to_char(${apiRequestLog.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

  const [volumeRow, latencyRow, dailyRows, endpointRows] = await Promise.all([
    db
      .select({
        day: sql<number>`count(*) filter (where ${apiRequestLog.createdAt} >= ${since24h})`,
        week: sql<number>`count(*) filter (where ${apiRequestLog.createdAt} >= ${since7d})`,
        month: sql<number>`count(*) filter (where ${apiRequestLog.createdAt} >= ${since30d})`,
      })
      .from(apiRequestLog)
      .where(eq(apiRequestLog.apiKeyId, apiKeyId)),
    db
      .select({
        min: sql<number>`coalesce(min(${apiRequestLog.durationMs}), 0)`,
        max: sql<number>`coalesce(max(${apiRequestLog.durationMs}), 0)`,
        p50: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${apiRequestLog.durationMs}), 0)`,
        p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${apiRequestLog.durationMs}), 0)`,
        p99: sql<number>`coalesce(percentile_cont(0.99) within group (order by ${apiRequestLog.durationMs}), 0)`,
      })
      .from(apiRequestLog)
      .where(and(eq(apiRequestLog.apiKeyId, apiKeyId), gte(apiRequestLog.createdAt, since30d))),
    db
      .select({
        date: dateExpr,
        total: sql<number>`count(*)`,
        errors: sql<number>`count(*) filter (where ${apiRequestLog.statusCode} >= 400)`,
      })
      .from(apiRequestLog)
      .where(and(eq(apiRequestLog.apiKeyId, apiKeyId), gte(apiRequestLog.createdAt, since30d)))
      .groupBy(dateExpr),
    db
      .select({
        endpoint: apiRequestLog.endpoint,
        requests: sql<number>`count(*)`,
        avgDuration: sql<number>`coalesce(avg(${apiRequestLog.durationMs}), 0)`,
        errors: sql<number>`count(*) filter (where ${apiRequestLog.statusCode} >= 400)`,
      })
      .from(apiRequestLog)
      .where(and(eq(apiRequestLog.apiKeyId, apiKeyId), gte(apiRequestLog.createdAt, since30d)))
      .groupBy(apiRequestLog.endpoint)
      .orderBy(desc(sql`count(*)`)),
  ]);

  const byDate = new Map(dailyRows.map((r) => [r.date, { total: Number(r.total), errors: Number(r.errors) }]));
  const labels: string[] = [];
  const requests: number[] = [];
  const errors: number[] = [];
  for (let i = 0; i < 30; i++) {
    const day = new Date(since30d.getTime() + i * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    const entry = byDate.get(key);
    labels.push(key);
    requests.push(entry?.total ?? 0);
    errors.push(entry?.errors ?? 0);
  }

  return {
    volume: { day: Number(volumeRow[0]?.day ?? 0), week: Number(volumeRow[0]?.week ?? 0), month: Number(volumeRow[0]?.month ?? 0) },
    latency: {
      min: Math.round(Number(latencyRow[0]?.min ?? 0)),
      max: Math.round(Number(latencyRow[0]?.max ?? 0)),
      p50: Math.round(Number(latencyRow[0]?.p50 ?? 0)),
      p95: Math.round(Number(latencyRow[0]?.p95 ?? 0)),
      p99: Math.round(Number(latencyRow[0]?.p99 ?? 0)),
    },
    daily: { labels, requests, errors },
    endpoints: endpointRows.map((r) => ({
      endpoint: r.endpoint,
      requests: Number(r.requests),
      avgDurationMs: Math.round(Number(r.avgDuration)),
      errorRatePercent: Number(r.requests) > 0 ? Math.round((Number(r.errors) / Number(r.requests)) * 10000) / 100 : 0,
    })),
  };
}

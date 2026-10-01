/**
 * GC-Stats - dashboard-personal-api-keys
 *
 * Personal (user-scoped) counterpart to dashboard-api-keys.ts, same row
 * shape, scoped by api_key.user_id instead of organization_id.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, apiRequestLog } from "@gc-stats/db";
import { getApiKeysOverview, type ApiKeysOverview } from "@/lib/api-key-stats";
import type { DashboardApiKeyRow } from "@/lib/dashboard-api-keys";

/** /dashboard/api-keys — same shape as lib/dashboard-api-keys.ts's org-scoped functions, scoped by api_key.user_id instead of organization_id (see /dashboard/[organizationId]/api-keys for the org version). */
export async function listPersonalApiKeys(userId: string): Promise<DashboardApiKeyRow[]> {
  const rows = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, keyHash: apiKeys.keyHash, rateLimit: apiKeys.rateLimit, isActive: apiKeys.isActive })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(asc(apiKeys.clientName));

  if (rows.length === 0) return [];

  const counts = await db
    .select({ apiKeyId: apiRequestLog.apiKeyId, requestCount: count() })
    .from(apiRequestLog)
    .where(inArray(apiRequestLog.apiKeyId, rows.map((r) => r.id)))
    .groupBy(apiRequestLog.apiKeyId);
  const byKey = new Map(counts.map((c) => [c.apiKeyId, Number(c.requestCount)]));

  return rows.map((r) => ({ ...r, keyHashPreview: r.keyHash.slice(0, 10), requestCount: byKey.get(r.id) ?? 0 }));
}

export async function getPersonalApiKeysOverview(userId: string): Promise<ApiKeysOverview> {
  const ownKeys = await db.select({ id: apiKeys.id, isActive: apiKeys.isActive }).from(apiKeys).where(eq(apiKeys.userId, userId));
  const activeKeyIds = ownKeys.filter((k) => k.isActive).map((k) => k.id);
  return getApiKeysOverview(activeKeyIds);
}

export async function getPersonalApiKey(userId: string, apiKeyId: number): Promise<DashboardApiKeyRow | null> {
  const [row] = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, keyHash: apiKeys.keyHash, rateLimit: apiKeys.rateLimit, isActive: apiKeys.isActive })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { ...row, keyHashPreview: row.keyHash.slice(0, 10), requestCount: 0 };
}

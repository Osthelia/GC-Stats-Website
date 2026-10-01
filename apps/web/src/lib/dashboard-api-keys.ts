/**
 * GC-Stats - dashboard-api-keys
 *
 * Organization-scoped API key management for the dashboard: listing with
 * request counts and the shared row/result shapes reused by the personal
 * API keys panel (dashboard-personal-api-keys.ts).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { apiKeys, apiRequestLog } from "@gc-stats/db";
import { getApiKeysOverview, type ApiKeysOverview } from "@/lib/api-key-stats";

export type { ApiKeysOverview as OrganizationApiKeysOverview } from "@/lib/api-key-stats";
export { getApiKeyStats, type ApiKeyStats } from "@/lib/api-key-stats";

/** Shared row shape for both the org-scoped panel (/dashboard/{id}/api-keys) and the personal one (/dashboard/api-keys, see lib/dashboard-personal-api-keys.ts) — same component renders either. */
export type DashboardApiKeyRow = {
  id: number;
  clientName: string;
  keyHashPreview: string;
  rateLimit: number | null;
  isActive: boolean;
  requestCount: number;
};

/** Shared result shape for the one lifecycle action self-service keys get — regenerate — whether the caller is regenerateOrganizationApiKey or regeneratePersonalApiKey. */
export type RegenerateApiKeyResult = { ok: true; plainKey: string } | { ok: false; error: "notFound" };

export async function listOrganizationApiKeys(organizationId: number): Promise<DashboardApiKeyRow[]> {
  const rows = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, keyHash: apiKeys.keyHash, rateLimit: apiKeys.rateLimit, isActive: apiKeys.isActive })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, organizationId))
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

export async function getOrganizationApiKeysOverview(organizationId: number): Promise<ApiKeysOverview> {
  const orgKeys = await db.select({ id: apiKeys.id, isActive: apiKeys.isActive }).from(apiKeys).where(eq(apiKeys.organizationId, organizationId));
  const activeKeyIds = orgKeys.filter((k) => k.isActive).map((k) => k.id);
  return getApiKeysOverview(activeKeyIds);
}

export async function getOrganizationApiKey(organizationId: number, apiKeyId: number): Promise<DashboardApiKeyRow | null> {
  const [row] = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, keyHash: apiKeys.keyHash, rateLimit: apiKeys.rateLimit, isActive: apiKeys.isActive })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.organizationId, organizationId)))
    .limit(1);
  if (!row) return null;
  return { ...row, keyHashPreview: row.keyHash.slice(0, 10), requestCount: 0 };
}

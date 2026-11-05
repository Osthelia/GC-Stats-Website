/**
 * GC-Stats - public-api-keys
 *
 * Self service public API keys of an account (/settings/api).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gte, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { apiKeys, apiRequestLog, users } from "@gc-stats/db";

export type PublicApiKeyRow = {
  id: number;
  clientName: string;
  usageDescription: string | null;
  keyHashPreview: string;
  isActive: boolean;
  suspended: boolean;
  createdAt: string;
  requests30d: number;
};

export async function listPublicApiKeys(userId: string): Promise<PublicApiKeyRow[]> {
  const rows = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, usageDescription: apiKeys.usageDescription, keyHash: apiKeys.keyHash, isActive: apiKeys.isActive, suspendedAt: apiKeys.suspendedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.kind, "public")))
    .orderBy(desc(apiKeys.isActive), desc(apiKeys.createdAt));
  if (rows.length === 0) return [];

  const counts = await db
    .select({ apiKeyId: apiRequestLog.apiKeyId, total: sql<number>`count(*)::int` })
    .from(apiRequestLog)
    .where(and(inArray(apiRequestLog.apiKeyId, rows.map((r) => r.id)), gte(apiRequestLog.createdAt, sql`now() - interval '30 days'`)))
    .groupBy(apiRequestLog.apiKeyId);
  const byKey = new Map(counts.map((c) => [c.apiKeyId, c.total]));

  return rows.map(({ keyHash, createdAt, suspendedAt, ...r }) => ({ ...r, suspended: suspendedAt !== null, keyHashPreview: keyHash.slice(0, 10), createdAt: createdAt.toISOString(), requests30d: byKey.get(r.id) ?? 0 }));
}

/** Active and suspended keys both take a slot, so a suspension cannot be dodged with a new key. */
export async function countUsedPublicApiKeySlots(userId: string, client: Pick<typeof db, "select"> = db): Promise<number> {
  const [row] = await client
    .select({ total: sql<number>`count(*)::int` })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.kind, "public"), or(eq(apiKeys.isActive, true), isNotNull(apiKeys.suspendedAt))));
  return row?.total ?? 0;
}

export async function isApiAccessBlocked(userId: string): Promise<boolean> {
  const [row] = await db.select({ blockedAt: users.apiAccessBlockedAt }).from(users).where(eq(users.id, userId)).limit(1);
  return !!row?.blockedAt;
}

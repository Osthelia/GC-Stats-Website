/**
 * GC-Stats - auth
 *
 * Resolves the `x-api-key` header against `api_key` for /api/v1 routes.
 * Looked up on every request, never cached: several replicas run side by side,
 * so a disabled or rotated key must stop working on all of them at once.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { apiKeys } from "@gc-stats/db";
import { hashApiKey } from "@/lib/api-key-crypto";
export type ResolvedApiKey = {
  id: number;
  clientName: string;
  rateLimit: number | null;
  kind: "partner" | "public";
  userId: string | null;
};
/** A suspended key is told so instead of getting a plain 401. */
export type ApiKeyLookup = ResolvedApiKey | { suspended: true } | null;
async function lookupApiKey(hash: string): Promise<ApiKeyLookup> {
  const [row] = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, rateLimit: apiKeys.rateLimit, isActive: apiKeys.isActive, kind: apiKeys.kind, userId: apiKeys.userId, suspendedAt: apiKeys.suspendedAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);
  if (!row) return null;
  if (row.suspendedAt) return { suspended: true };
  if (!row.isActive) return null;
  return { id: row.id, clientName: row.clientName, rateLimit: row.rateLimit, kind: row.kind === "public" ? "public" : "partner", userId: row.userId };
}
/** Validates the `x-api-key` header against `api_key`, `null` when missing, unknown or inactive. */
export async function resolveApiKey(request: Request): Promise<ApiKeyLookup> {
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) return null;
  return lookupApiKey(hashApiKey(rawKey));
}

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
};

async function lookupApiKey(hash: string): Promise<ResolvedApiKey | null> {
  const [row] = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, rateLimit: apiKeys.rateLimit, isActive: apiKeys.isActive })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  const resolved = row && row.isActive ? { id: row.id, clientName: row.clientName, rateLimit: row.rateLimit } : null;
  return resolved;
}

/** Validates the `x-api-key` header against `api_key` — returns `null` when missing/unknown/inactive. */
export async function resolveApiKey(request: Request): Promise<ResolvedApiKey | null> {
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) return null;
  return lookupApiKey(hashApiKey(rawKey));
}

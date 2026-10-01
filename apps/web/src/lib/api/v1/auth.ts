/**
 * GC-Stats - auth
 *
 * Resolves and caches the `x-api-key` header against `api_key` for
 * /api/v1 routes, with cache invalidation on key toggle/delete/rotate.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { apiKeys } from "@gc-stats/db";
import { hashApiKey } from "@/lib/api-key-crypto";
import { TtlCache } from "@/lib/ttl-cache";

export type ResolvedApiKey = {
  id: number;
  clientName: string;
  rateLimit: number | null;
};

// Same TTL/`Map` pattern as lib/twitch-client.ts / lib/riot-content-client.ts
// — no Redis in V2 (cf. SUIVI.md), a single Node process is enough for a
// short-lived key lookup cache.
//
// Cloudflare Workers only: skip the cache entirely rather than cache it.
// `invalidateApiKeyCache` below only busts the isolate that handled the
// mutating request — every other isolate would otherwise keep serving a
// disabled/rotated key for up to CACHE_TTL_MS, a real security gap, not
// just staleness. Hyperdrive makes a fresh lookup cheap enough per request.
const CACHE_TTL_MS = 60_000;
const cache = new TtlCache<ResolvedApiKey | null>(CACHE_TTL_MS, 10_000);
const useCache = process.env.DEPLOY_TARGET !== "cloudflare";

async function lookupApiKey(hash: string): Promise<ResolvedApiKey | null> {
  const cached = useCache ? cache.get(hash) : undefined;
  if (cached !== undefined) return cached;

  const [row] = await db
    .select({ id: apiKeys.id, clientName: apiKeys.clientName, rateLimit: apiKeys.rateLimit, isActive: apiKeys.isActive })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  const resolved = row && row.isActive ? { id: row.id, clientName: row.clientName, rateLimit: row.rateLimit } : null;
  if (useCache) cache.set(hash, resolved);
  return resolved;
}

/** Validates the `x-api-key` header against `api_key` — returns `null` when missing/unknown/inactive. */
export async function resolveApiKey(request: Request): Promise<ResolvedApiKey | null> {
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) return null;
  return lookupApiKey(hashApiKey(rawKey));
}

/** Called by toggleApiKeyActive/deleteApiKey/regenerateApiKey right after their DB write, so a disabled/rotated key stops working immediately instead of up to CACHE_TTL_MS later. */
export function invalidateApiKeyCache(hash: string): void {
  cache.delete(hash);
}

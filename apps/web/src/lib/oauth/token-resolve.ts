/**
 * GC-Stats - token-resolve
 *
 * Validates a Bearer access token from an Authorization header, cached
 * briefly (bypassed on Cloudflare) since a revoked token must stop working
 * immediately rather than waiting out the cache TTL.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthAccessTokens, oauthClients } from "@gc-stats/db";
import { hashOpaqueToken } from "@/lib/oauth/token-crypto";
import { TtlCache } from "@/lib/ttl-cache";
import type { OAuthScope } from "@/lib/oauth/scopes";

export type ResolvedAccessToken = { userId: string; clientId: number; scopes: OAuthScope[] };

// Same cache shape as lib/api/v1/auth.ts/lib/oauth/client-auth.ts — an access
// token can be revoked (refresh rotation reuse, user-initiated revoke at
// /settings/connections) and must stop working immediately, not up to
// CACHE_TTL_MS later.
const CACHE_TTL_MS = 60_000;
const cache = new TtlCache<ResolvedAccessToken | null>(CACHE_TTL_MS, 10_000);
const useCache = process.env.DEPLOY_TARGET !== "cloudflare";

async function lookupAccessToken(hash: string): Promise<ResolvedAccessToken | null> {
  const cached = useCache ? cache.get(hash) : undefined;
  if (cached !== undefined) return cached;

  const [row] = await db
    .select({ userId: oauthAccessTokens.userId, clientId: oauthAccessTokens.clientId, scopes: oauthAccessTokens.scopes, expiresAt: oauthAccessTokens.expiresAt, revokedAt: oauthAccessTokens.revokedAt })
    .from(oauthAccessTokens)
    // A deactivated client's tokens stop working right away, not at expiry.
    .innerJoin(oauthClients, and(eq(oauthClients.id, oauthAccessTokens.clientId), eq(oauthClients.isActive, true)))
    .where(eq(oauthAccessTokens.tokenHash, hash))
    .limit(1);

  const valid = row && !row.revokedAt && row.expiresAt.getTime() > Date.now();
  const resolved = valid ? { userId: row.userId, clientId: row.clientId, scopes: row.scopes as OAuthScope[] } : null;
  if (useCache) cache.set(hash, resolved);
  return resolved;
}

/** Validates a `Bearer` access token from an Authorization header — returns `null` when missing/unknown/expired/revoked. */
export async function resolveAccessToken(request: Request): Promise<ResolvedAccessToken | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return lookupAccessToken(hashOpaqueToken(header.slice("Bearer ".length).trim()));
}

export function invalidateAccessTokenCache(hash: string): void {
  cache.delete(hash);
}

/**
 * GC-Stats - client-auth
 *
 * Resolves and caches registered OAuth clients (/oauth/authorize,
 * /api/oauth/token) and verifies confidential client secrets. The in-memory
 * cache is bypassed on Cloudflare so an admin deactivating a client takes
 * effect immediately rather than waiting out the TTL.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthClients } from "@gc-stats/db";
import { hashOpaqueToken } from "@/lib/oauth/token-crypto";
import { TtlCache } from "@/lib/ttl-cache";
import type { OAuthScope } from "@/lib/oauth/scopes";

export type ResolvedOAuthClient = {
  id: number;
  name: string;
  clientId: string;
  clientSecretHash: string | null;
  isConfidential: boolean;
  redirectUris: string[];
  allowedScopes: OAuthScope[];
  logoUrl: string | null;
};

// Same in-memory-cache-with-Cloudflare-bypass shape as lib/api/v1/auth.ts —
// a client is looked up on every /oauth/authorize and /api/oauth/token call,
// and admin actions must be able to invalidate it immediately (deactivating
// a compromised client can't wait up to CACHE_TTL_MS).
const CACHE_TTL_MS = 60_000;
const cache = new TtlCache<ResolvedOAuthClient | null>(CACHE_TTL_MS, 1_000);
const useCache = process.env.DEPLOY_TARGET !== "cloudflare";

export async function resolveOAuthClient(clientId: string): Promise<ResolvedOAuthClient | null> {
  const cached = useCache ? cache.get(clientId) : undefined;
  if (cached !== undefined) return cached;

  const [row] = await db
    .select({
      id: oauthClients.id,
      name: oauthClients.name,
      clientId: oauthClients.clientId,
      clientSecretHash: oauthClients.clientSecretHash,
      isConfidential: oauthClients.isConfidential,
      redirectUris: oauthClients.redirectUris,
      allowedScopes: oauthClients.allowedScopes,
      logoUrl: oauthClients.logoUrl,
      isActive: oauthClients.isActive,
    })
    .from(oauthClients)
    .where(eq(oauthClients.clientId, clientId))
    .limit(1);

  const resolved =
    row && row.isActive
      ? {
          id: row.id,
          name: row.name,
          clientId: row.clientId,
          clientSecretHash: row.clientSecretHash,
          isConfidential: row.isConfidential,
          redirectUris: row.redirectUris,
          allowedScopes: row.allowedScopes as OAuthScope[],
          logoUrl: row.logoUrl,
        }
      : null;

  if (useCache) cache.set(clientId, resolved);
  return resolved;
}

export function invalidateOAuthClientCache(clientId: string): void {
  cache.delete(clientId);
}

/** Confidential clients authenticate with their secret at /api/oauth/token — public clients rely on PKCE alone. */
export function verifyClientSecret(client: ResolvedOAuthClient, presentedSecret: string | null): boolean {
  if (!client.isConfidential) return true;
  if (!presentedSecret || !client.clientSecretHash) return false;
  const presented = Buffer.from(hashOpaqueToken(presentedSecret));
  const expected = Buffer.from(client.clientSecretHash);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

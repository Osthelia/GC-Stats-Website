/**
 * GC-Stats - token-resolve
 *
 * Validates a Bearer access token from an Authorization header. Looked up on
 * every call, never cached: a revoked token must stop working immediately on
 * every replica.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthAccessTokens, oauthClients } from "@gc-stats/db";
import { hashOpaqueToken } from "@/lib/oauth/token-crypto";
import type { OAuthScope } from "@/lib/oauth/scopes";

export type ResolvedAccessToken = { userId: string; clientId: number; scopes: OAuthScope[] };

async function lookupAccessToken(hash: string): Promise<ResolvedAccessToken | null> {
  const [row] = await db
    .select({ userId: oauthAccessTokens.userId, clientId: oauthAccessTokens.clientId, scopes: oauthAccessTokens.scopes, expiresAt: oauthAccessTokens.expiresAt, revokedAt: oauthAccessTokens.revokedAt })
    .from(oauthAccessTokens)
    // A deactivated client's tokens stop working right away, not at expiry.
    .innerJoin(oauthClients, and(eq(oauthClients.id, oauthAccessTokens.clientId), eq(oauthClients.isActive, true)))
    .where(eq(oauthAccessTokens.tokenHash, hash))
    .limit(1);

  const valid = row && !row.revokedAt && row.expiresAt.getTime() > Date.now();
  const resolved = valid ? { userId: row.userId, clientId: row.clientId, scopes: row.scopes as OAuthScope[] } : null;
  return resolved;
}

/** Validates a `Bearer` access token from an Authorization header — returns `null` when missing/unknown/expired/revoked. */
export async function resolveAccessToken(request: Request): Promise<ResolvedAccessToken | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return lookupAccessToken(hashOpaqueToken(header.slice("Bearer ".length).trim()));
}

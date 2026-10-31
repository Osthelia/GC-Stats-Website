/**
 * GC-Stats - client-auth
 *
 * Resolves registered OAuth clients (/oauth/authorize, /api/oauth/token) and
 * verifies confidential client secrets. Looked up on every call, never cached:
 * an admin deactivating a client must take effect on every replica at once.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthClients } from "@gc-stats/db";
import { hashOpaqueToken } from "@/lib/oauth/token-crypto";
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

export async function resolveOAuthClient(clientId: string): Promise<ResolvedOAuthClient | null> {
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

  return resolved;
}

/** Confidential clients authenticate with their secret at /api/oauth/token — public clients rely on PKCE alone. */
export function verifyClientSecret(client: ResolvedOAuthClient, presentedSecret: string | null): boolean {
  if (!client.isConfidential) return true;
  if (!presentedSecret || !client.clientSecretHash) return false;
  const presented = Buffer.from(hashOpaqueToken(presentedSecret));
  const expected = Buffer.from(client.clientSecretHash);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

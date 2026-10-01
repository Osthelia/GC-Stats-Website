/**
 * GC-Stats - oauth-authorize
 *
 * Server action approving an OAuth authorization request and issuing the
 * authorization code. Re-validates client, redirect URI and scopes
 * server-side rather than trusting the params from the client component.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthConsents } from "@gc-stats/db";
import { getCurrentUserId } from "@/lib/session";
import { resolveOAuthClient } from "@/lib/oauth/client-auth";
import { issueAuthorizationCode } from "@/lib/oauth/issue-code";
import { isValidCodeChallenge } from "@/lib/oauth/token-crypto";
import type { OAuthScope } from "@/lib/oauth/scopes";

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  scopes: OAuthScope[];
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
};

function buildRedirect(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

export type AuthorizeResult = { redirectTo: string } | { error: "invalid_request" };

/**
 * Re-validates everything the page already checked (client active, redirectUri
 * registered, scopes allowed) before writing anything — the params come from a
 * client component, never trust a value just because the page rendered it.
 */
export async function approveAuthorization(params: AuthorizeParams): Promise<AuthorizeResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "invalid_request" };

  const client = await resolveOAuthClient(params.clientId);
  if (!client || !client.redirectUris.includes(params.redirectUri)) return { error: "invalid_request" };
  if (!Array.isArray(params.scopes) || params.scopes.some((s) => !client.allowedScopes.includes(s))) return { error: "invalid_request" };
  if (typeof params.codeChallenge !== "string" || !isValidCodeChallenge(params.codeChallenge) || params.codeChallengeMethod !== "S256") return { error: "invalid_request" };
  if (params.state !== null && typeof params.state !== "string") return { error: "invalid_request" };

  const [existingConsent] = await db
    .select({ scopes: oauthConsents.scopes })
    .from(oauthConsents)
    .where(and(eq(oauthConsents.userId, userId), eq(oauthConsents.clientId, client.id)))
    .limit(1);

  const grantedScopes = [...new Set([...(existingConsent?.scopes ?? []), ...params.scopes])] as OAuthScope[];

  await db
    .insert(oauthConsents)
    .values({ userId, clientId: client.id, scopes: grantedScopes })
    .onConflictDoUpdate({ target: [oauthConsents.userId, oauthConsents.clientId], set: { scopes: grantedScopes, updatedAt: new Date() } });

  const code = await issueAuthorizationCode({
    clientDbId: client.id,
    userId,
    redirectUri: params.redirectUri,
    scopes: params.scopes,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: "S256",
  });

  return { redirectTo: buildRedirect(params.redirectUri, { code, state: params.state }) };
}

export async function denyAuthorization(params: { clientId: string; redirectUri: string; state: string | null }): Promise<AuthorizeResult> {
  const client = await resolveOAuthClient(params.clientId);
  if (!client || !client.redirectUris.includes(params.redirectUri)) return { error: "invalid_request" };
  return { redirectTo: buildRedirect(params.redirectUri, { error: "access_denied", state: typeof params.state === "string" ? params.state : null }) };
}

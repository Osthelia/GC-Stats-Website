/**
 * GC-Stats - route
 *
 * OAuth 2.0 token endpoint. Handles the authorization_code (with PKCE) and
 * refresh_token grants, issuing opaque access/refresh token pairs. Detects
 * authorization code replay and refresh token reuse, and revokes every live
 * token for the client/user pair when it happens.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthAuthorizationCodes, oauthAccessTokens, oauthRefreshTokens, oauthConsents } from "@gc-stats/db";
import { resolveOAuthClient, verifyClientSecret, type ResolvedOAuthClient } from "@/lib/oauth/client-auth";
import { generateOpaqueToken, hashOpaqueToken, verifyPkce } from "@/lib/oauth/token-crypto";
import { checkOAuthRateLimit } from "@/lib/oauth/rate-limit";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";
import { getClientIp } from "@/lib/client-ip";
import type { OAuthScope } from "@/lib/oauth/scopes";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const REQUESTS_PER_MINUTE_PER_IP = 60;
const REQUESTS_PER_MINUTE_PER_CLIENT = 600;

// RFC 6749 §5.1: token responses must never be cached.
const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function oauthError(status: number, error: string, description?: string) {
  return NextResponse.json({ error, error_description: description }, { status, headers: NO_STORE });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function insertTokenPair(tx: Tx, clientDbId: number, userId: string, scopes: OAuthScope[]) {
  const plainAccessToken = generateOpaqueToken("gcs_at_");
  const plainRefreshToken = generateOpaqueToken("gcs_rt_");
  const now = Date.now();

  await tx.insert(oauthAccessTokens).values({
    tokenHash: hashOpaqueToken(plainAccessToken),
    clientId: clientDbId,
    userId,
    scopes,
    expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
  });
  const [refresh] = await tx
    .insert(oauthRefreshTokens)
    .values({
      tokenHash: hashOpaqueToken(plainRefreshToken),
      clientId: clientDbId,
      userId,
      scopes,
      expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    })
    .returning({ id: oauthRefreshTokens.id });

  return { plainAccessToken, plainRefreshToken, refreshId: refresh!.id };
}

function tokenResponse(plainAccessToken: string, plainRefreshToken: string, scopes: OAuthScope[]) {
  return NextResponse.json(
    {
      access_token: plainAccessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_TTL_MS / 1000,
      refresh_token: plainRefreshToken,
      scope: scopes.join(" "),
    },
    { headers: NO_STORE },
  );
}

async function handleAuthorizationCode(form: FormData, client: ResolvedOAuthClient) {
  const code = form.get("code");
  const redirectUri = form.get("redirect_uri");
  const codeVerifier = form.get("code_verifier");
  if (typeof code !== "string" || typeof redirectUri !== "string" || typeof codeVerifier !== "string") {
    return oauthError(400, "invalid_request");
  }

  const codeHash = hashOpaqueToken(code);
  const [row] = await db.select().from(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.codeHash, codeHash)).limit(1);
  if (!row || row.clientId !== client.id) return oauthError(400, "invalid_grant", "Code is invalid, expired, or already used.");

  if (row.usedAt) {
    // RFC 6749 §4.1.2: a replayed code revokes what it already issued.
    await revokeOAuthTokens({ userId: row.userId, clientId: row.clientId });
    return oauthError(400, "invalid_grant", "Code is invalid, expired, or already used.");
  }
  if (row.expiresAt.getTime() < Date.now()) return oauthError(400, "invalid_grant", "Code is invalid, expired, or already used.");
  if (row.redirectUri !== redirectUri) return oauthError(400, "invalid_grant", "redirect_uri mismatch.");
  if (!verifyPkce(codeVerifier, row.codeChallenge)) return oauthError(400, "invalid_grant", "PKCE verification failed.");

  const scopes = (row.scopes as OAuthScope[]).filter((s) => client.allowedScopes.includes(s));

  const issued = await db.transaction(async (tx) => {
    // Conditional consume: of two concurrent exchanges, only one gets the row back.
    const [consumed] = await tx
      .update(oauthAuthorizationCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(oauthAuthorizationCodes.id, row.id), isNull(oauthAuthorizationCodes.usedAt)))
      .returning({ id: oauthAuthorizationCodes.id });
    if (!consumed) return null;
    return insertTokenPair(tx, row.clientId, row.userId, scopes);
  });

  if (!issued) {
    await revokeOAuthTokens({ userId: row.userId, clientId: row.clientId });
    return oauthError(400, "invalid_grant", "Code is invalid, expired, or already used.");
  }
  return tokenResponse(issued.plainAccessToken, issued.plainRefreshToken, scopes);
}

async function handleRefreshToken(form: FormData, client: ResolvedOAuthClient) {
  const refreshToken = form.get("refresh_token");
  if (typeof refreshToken !== "string") return oauthError(400, "invalid_request");

  const tokenHash = hashOpaqueToken(refreshToken);
  const [row] = await db.select().from(oauthRefreshTokens).where(eq(oauthRefreshTokens.tokenHash, tokenHash)).limit(1);
  if (!row || row.clientId !== client.id) return oauthError(400, "invalid_grant");

  if (row.revokedAt) {
    // A rotated away (or revoked) refresh token presented again is a sign of
    // theft: kill the whole client/user family, not just this request.
    await revokeOAuthTokens({ userId: row.userId, clientId: row.clientId });
    return oauthError(400, "invalid_grant", "Refresh token reuse detected, all tokens revoked.");
  }
  if (row.expiresAt.getTime() < Date.now()) return oauthError(400, "invalid_grant");

  // Scopes can only shrink: the client's current allow list and the user's
  // current consent both cap what a refresh may carry forward.
  const [consent] = await db
    .select({ scopes: oauthConsents.scopes })
    .from(oauthConsents)
    .where(and(eq(oauthConsents.userId, row.userId), eq(oauthConsents.clientId, row.clientId)))
    .limit(1);
  if (!consent) {
    await revokeOAuthTokens({ userId: row.userId, clientId: row.clientId });
    return oauthError(400, "invalid_grant", "Consent was revoked.");
  }
  const scopes = (row.scopes as OAuthScope[]).filter((s) => client.allowedScopes.includes(s) && consent.scopes.includes(s));

  const issued = await db.transaction(async (tx) => {
    // Conditional revoke: of two concurrent refreshes, only one rotates.
    const [rotated] = await tx
      .update(oauthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(oauthRefreshTokens.id, row.id), isNull(oauthRefreshTokens.revokedAt), gt(oauthRefreshTokens.expiresAt, new Date())))
      .returning({ id: oauthRefreshTokens.id });
    if (!rotated) return null;
    const pair = await insertTokenPair(tx, row.clientId, row.userId, scopes);
    await tx.update(oauthRefreshTokens).set({ rotatedToId: pair.refreshId }).where(eq(oauthRefreshTokens.id, row.id));
    return pair;
  });

  if (!issued) {
    await revokeOAuthTokens({ userId: row.userId, clientId: row.clientId });
    return oauthError(400, "invalid_grant", "Refresh token reuse detected, all tokens revoked.");
  }
  return tokenResponse(issued.plainAccessToken, issued.plainRefreshToken, scopes);
}

export async function POST(request: Request) {
  // Per IP before authentication: client_id is public, keying on it here
  // would let anyone exhaust a legitimate client's quota.
  if (!(await checkOAuthRateLimit(`token:ip:${getClientIp(request.headers)}`, REQUESTS_PER_MINUTE_PER_IP))) return oauthError(429, "slow_down");

  const form = await request.formData().catch(() => null);
  if (!form) return oauthError(400, "invalid_request");

  const grantType = form.get("grant_type");
  const clientId = form.get("client_id");
  const clientSecret = form.get("client_secret");
  if (typeof clientId !== "string") return oauthError(400, "invalid_request");

  const client = await resolveOAuthClient(clientId);
  if (!client) return oauthError(401, "invalid_client");
  if (!verifyClientSecret(client, typeof clientSecret === "string" ? clientSecret : null)) return oauthError(401, "invalid_client");

  if (!(await checkOAuthRateLimit(`token:client:${client.id}`, REQUESTS_PER_MINUTE_PER_CLIENT))) return oauthError(429, "slow_down");

  if (grantType === "authorization_code") return handleAuthorizationCode(form, client);
  if (grantType === "refresh_token") return handleRefreshToken(form, client);
  return oauthError(400, "unsupported_grant_type");
}

/**
 * GC-Stats - route
 *
 * OAuth token revocation endpoint, RFC 7009 minimal implementation. Always
 * returns 200 once the client is authenticated, whether or not the token
 * existed or belonged to that client, per spec (never an oracle).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { oauthAccessTokens, oauthRefreshTokens } from "@gc-stats/db";
import { resolveOAuthClient, verifyClientSecret } from "@/lib/oauth/client-auth";
import { hashOpaqueToken } from "@/lib/oauth/token-crypto";
import { invalidateAccessTokenCache } from "@/lib/oauth/token-resolve";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";
import { checkOAuthRateLimit } from "@/lib/oauth/rate-limit";
import { getClientIp } from "@/lib/client-ip";

const REQUESTS_PER_MINUTE_PER_IP = 60;

export async function POST(request: Request) {
  if (!(await checkOAuthRateLimit(`revoke:ip:${getClientIp(request.headers)}`, REQUESTS_PER_MINUTE_PER_IP))) {
    return NextResponse.json({ error: "slow_down" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const token = form.get("token");
  const clientId = form.get("client_id");
  const clientSecret = form.get("client_secret");
  if (typeof token !== "string" || typeof clientId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const client = await resolveOAuthClient(clientId);
  if (!client || !verifyClientSecret(client, typeof clientSecret === "string" ? clientSecret : null)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  // Only tokens issued to this client (RFC 7009 §2.1).
  const tokenHash = hashOpaqueToken(token);
  const now = new Date();
  await db
    .update(oauthAccessTokens)
    .set({ revokedAt: now })
    .where(and(eq(oauthAccessTokens.tokenHash, tokenHash), eq(oauthAccessTokens.clientId, client.id)));
  invalidateAccessTokenCache(tokenHash);

  // A revoked refresh token takes its access tokens down with it.
  const [refresh] = await db
    .update(oauthRefreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(oauthRefreshTokens.tokenHash, tokenHash), eq(oauthRefreshTokens.clientId, client.id)))
    .returning({ userId: oauthRefreshTokens.userId });
  if (refresh) await revokeOAuthTokens({ userId: refresh.userId, clientId: client.id });

  return new NextResponse(null, { status: 200 });
}

/**
 * GC-Stats - route
 *
 * OAuth userinfo endpoint. Resolves the bearer access token and returns the
 * claims allowed by its granted scopes.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { resolveAccessToken } from "@/lib/oauth/token-resolve";
import { resolveOAuthClaims } from "@/lib/oauth/scopes";

// Claims carry personal data (email, linked accounts): never cached.
const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

export async function GET(request: Request) {
  const token = await resolveAccessToken(request);
  if (!token) return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: NO_STORE });

  const claims = await resolveOAuthClaims(token.userId, token.scopes);
  return NextResponse.json(claims, { headers: NO_STORE });
}

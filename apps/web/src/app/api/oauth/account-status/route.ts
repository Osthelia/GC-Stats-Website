/**
 * GC-Stats - route
 *
 * OAuth account status endpoint. Lets a confidential client ask whether a
 * user id (`sub`) still exists, so it can drop the data of deleted accounts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { resolveOAuthClient, verifyClientSecret } from "@/lib/oauth/client-auth";
import { checkOAuthRateLimit } from "@/lib/oauth/rate-limit";
import { getClientIp } from "@/lib/client-ip";

const REQUESTS_PER_MINUTE_PER_IP = 60;
const REQUESTS_PER_MINUTE_PER_CLIENT = 600;
const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

export async function POST(request: Request) {
  if (!(await checkOAuthRateLimit(`status:ip:${getClientIp(request.headers)}`, REQUESTS_PER_MINUTE_PER_IP))) {
    return NextResponse.json({ error: "slow_down" }, { status: 429, headers: NO_STORE });
  }

  const form = await request.formData().catch(() => null);
  const clientId = form?.get("client_id");
  const clientSecret = form?.get("client_secret");
  const sub = form?.get("sub");
  if (typeof clientId !== "string" || typeof sub !== "string" || !sub || sub.length > 128) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });
  }

  // Confidential clients only: a public client has no secret to prove who is asking.
  const client = await resolveOAuthClient(clientId);
  if (!client || !client.isConfidential || !verifyClientSecret(client, typeof clientSecret === "string" ? clientSecret : null)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: NO_STORE });
  }
  if (!(await checkOAuthRateLimit(`status:client:${client.id}`, REQUESTS_PER_MINUTE_PER_CLIENT))) {
    return NextResponse.json({ error: "slow_down" }, { status: 429, headers: NO_STORE });
  }

  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, sub)).limit(1);
  return NextResponse.json({ exists: Boolean(row) }, { headers: NO_STORE });
}

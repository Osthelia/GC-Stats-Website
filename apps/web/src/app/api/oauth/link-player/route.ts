/**
 * GC-Stats - route
 *
 * First OAuth-authenticated write action: a third-party app (with the
 * `link_player` scope) proposes linking the token's account to a `people`
 * row. Never applied directly, always lands as a change_requests row
 * (subjectType "person", field "user_link") for staff review, same
 * moderation gate as every other identity-affecting edit on the site.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { people, changeRequests, changeRequestItems } from "@gc-stats/db";
import { visiblePerson } from "@/lib/ghost-visibility";
import { resolveAccessToken } from "@/lib/oauth/token-resolve";
import { checkOAuthRateLimit } from "@/lib/oauth/rate-limit";

const LINK_REQUESTS_PER_MINUTE = 10;

function oauthError(status: number, error: string, description?: string) {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function POST(request: Request) {
  const token = await resolveAccessToken(request);
  if (!token) return oauthError(401, "invalid_token");
  if (!token.scopes.includes("link_player")) return oauthError(403, "insufficient_scope", "This token was not granted the link_player scope.");

  if (!(await checkOAuthRateLimit(`link-player:${token.userId}`, LINK_REQUESTS_PER_MINUTE))) return oauthError(429, "slow_down");

  const body = (await request.json().catch(() => null)) as { personId?: unknown } | null;
  const personId = body && typeof body.personId === "number" && Number.isInteger(body.personId) && body.personId > 0 ? body.personId : null;
  if (!personId) return oauthError(400, "invalid_request", "personId must be a positive integer.");

  const [target] = await db.select({ id: people.id, userId: people.userId }).from(people).where(and(eq(people.id, personId), visiblePerson)).limit(1);
  if (!target) return oauthError(404, "not_found", "No player with that id.");

  if (target.userId === token.userId) return NextResponse.json({ status: "already_linked" });
  if (target.userId) return oauthError(409, "already_linked", "This player is already linked to another account.");

  // One pending link request per account, whatever the target: stops an app
  // from flooding the moderation queue with requests on many players.
  const [pendingRequest] = await db
    .select({ id: changeRequests.id })
    .from(changeRequests)
    .innerJoin(changeRequestItems, eq(changeRequestItems.changeRequestId, changeRequests.id))
    .where(
      and(
        eq(changeRequests.subjectType, "person"),
        eq(changeRequests.requestedBy, token.userId),
        eq(changeRequestItems.field, "user_link"),
        eq(changeRequestItems.status, "pending")
      )
    )
    .limit(1);
  if (pendingRequest) return oauthError(409, "request_pending", "A player link request for this account is already pending review.");

  // The account may already have a different player linked (people.userId is
  // unique) — the request still goes through, carrying the old link as
  // oldValue, and a moderator applies both sides (unlink + link) together
  // when approving (see actions/admin-change-requests.ts "user_link").
  const [previous] = await db.select({ id: people.id }).from(people).where(eq(people.userId, token.userId)).limit(1);
  const previousPersonId = previous && previous.id !== personId ? previous.id : null;

  const changeRequestId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(changeRequests)
      .values({ subjectType: "person", subjectId: personId, requestedBy: token.userId, reason: null, status: "pending" })
      .returning({ id: changeRequests.id });
    await tx.insert(changeRequestItems).values({
      changeRequestId: row!.id,
      field: "user_link",
      oldValue: { previousPersonId },
      newValue: { userId: token.userId, previousPersonId },
      status: "pending",
    });
    return row!.id;
  });

  return NextResponse.json({ status: "pending", changeRequestId }, { status: 201 });
}

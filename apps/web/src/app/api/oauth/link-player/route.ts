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
import { gameTables, sharedPeople } from "@gc-stats/db";
import { ensureGameProfile } from "@/lib/person-service";
import { getUserLinkStatus, buildUserLinkItem } from "@/lib/user-link-request";
import { DEFAULT_GAME, isGameSlug, type GameSlug } from "@gc-stats/db/game";
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

  const body = (await request.json().catch(() => null)) as { personId?: unknown; game?: unknown } | null;
  // Apps written before LoL existed send no game: that is Valorant.
  const game: GameSlug = body && isGameSlug(body.game) ? body.game : DEFAULT_GAME;
  const { people, changeRequests, changeRequestItems } = gameTables(game);
  const personId = body && typeof body.personId === "number" && Number.isInteger(body.personId) && body.personId > 0 ? body.personId : null;
  if (!personId) return oauthError(400, "invalid_request", "personId must be a positive integer.");

  // The account already owns this person: the link exists for every game, only the game profile may be missing.
  const [owned] = await db.select({ id: sharedPeople.id }).from(sharedPeople).where(and(eq(sharedPeople.id, personId), eq(sharedPeople.userId, token.userId))).limit(1);
  if (owned) {
    await ensureGameProfile(db, game, personId);
    return NextResponse.json({ status: "already_linked" });
  }

  const [target] = await db.select({ id: people.id }).from(people).where(and(eq(people.id, personId), visiblePerson(game))).limit(1);
  if (!target) return oauthError(404, "not_found", "No player with that id.");

  const status = await getUserLinkStatus(game, token.userId, personId);
  if (status.state === "linkedToYou") return NextResponse.json({ status: "already_linked" });
  if (status.state === "linkedToOther") return oauthError(409, "already_linked", "This player is already linked to another account.");
  if (status.state === "pending") return oauthError(409, "request_pending", "A player link request for this account is already pending review.");
  if (status.state === "linkedToAnotherPerson") return oauthError(409, "linked_to_another_player", "This account is already linked to another player. Ask staff to merge both profiles.");
  if (status.state === "notFound") return oauthError(404, "not_found", "No player with that id.");
  const item = buildUserLinkItem(token.userId);

  const changeRequestId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(changeRequests)
      .values({ subjectType: "person", subjectId: personId, requestedBy: token.userId, reason: null, status: "pending" })
      .returning({ id: changeRequests.id });
    await tx.insert(changeRequestItems).values({ changeRequestId: row!.id, ...item, status: "pending" });
    return row!.id;
  });

  return NextResponse.json({ status: "pending", changeRequestId }, { status: 201 });
}

/**
 * GC-Stats - user-link-request
 *
 * Shared rules for a "link my account to this player" change request item
 * (field "user_link"), used by the suggest-edit form and the OAuth
 * link_player route. Applied by staff in actions/admin-change-requests.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables, sharedPeople } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";

export type UserLinkStatus =
  | { state: "available" }
  | { state: "linkedToYou" }
  | { state: "linkedToOther" }
  // The account already belongs to another person: both rows are the same human, staff merges them.
  | { state: "linkedToAnotherPerson" }
  | { state: "pending" }
  | { state: "notFound" };

export type UserLinkItem = { field: "user_link"; oldValue: { previousPersonId: null }; newValue: { userId: string; previousPersonId: null } };

/** Whether `userId` can request a link to `personId` right now. */
export async function getUserLinkStatus(game: GameSlug, userId: string, personId: number): Promise<UserLinkStatus> {
  const { people, changeRequests, changeRequestItems } = gameTables(game);
  const [target] = await db.select({ userId: people.userId }).from(people).where(eq(people.id, personId)).limit(1);
  if (!target) return { state: "notFound" };
  if (target.userId === userId) return { state: "linkedToYou" };
  if (target.userId) return { state: "linkedToOther" };

  // One pending link request per account, whatever the target player.
  const [pendingRequest] = await db
    .select({ id: changeRequests.id })
    .from(changeRequests)
    .innerJoin(changeRequestItems, eq(changeRequestItems.changeRequestId, changeRequests.id))
    .where(
      and(
        eq(changeRequests.subjectType, "person"),
        eq(changeRequests.requestedBy, userId),
        eq(changeRequests.status, "pending"),
        eq(changeRequestItems.field, "user_link"),
        eq(changeRequestItems.status, "pending")
      )
    )
    .limit(1);
  if (pendingRequest) return { state: "pending" };

  // An account links to one person for every game, never swapped silently.
  const [linked] = await db.select({ id: sharedPeople.id }).from(sharedPeople).where(eq(sharedPeople.userId, userId)).limit(1);
  if (linked) return { state: "linkedToAnotherPerson" };
  return { state: "available" };
}

export function buildUserLinkItem(userId: string): UserLinkItem {
  return { field: "user_link", oldValue: { previousPersonId: null }, newValue: { userId, previousPersonId: null } };
}

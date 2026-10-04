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
import { people, changeRequests, changeRequestItems } from "@gc-stats/db";

export type UserLinkStatus =
  | { state: "available"; previousPersonId: number | null }
  | { state: "linkedToYou" }
  | { state: "linkedToOther" }
  | { state: "pending" }
  | { state: "notFound" };

export type UserLinkItem = { field: "user_link"; oldValue: { previousPersonId: number | null }; newValue: { userId: string; previousPersonId: number | null } };

/** Whether `userId` can request a link to `personId` right now. */
export async function getUserLinkStatus(userId: string, personId: number): Promise<UserLinkStatus> {
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

  // people.userId is unique: an existing link elsewhere is carried along and swapped on approval.
  const [previous] = await db.select({ id: people.id }).from(people).where(eq(people.userId, userId)).limit(1);
  return { state: "available", previousPersonId: previous?.id ?? null };
}

export function buildUserLinkItem(userId: string, previousPersonId: number | null): UserLinkItem {
  return { field: "user_link", oldValue: { previousPersonId }, newValue: { userId, previousPersonId } };
}

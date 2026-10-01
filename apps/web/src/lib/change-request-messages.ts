/**
 * GC-Stats - change-request-messages
 *
 * Lists the append-only discussion thread on a change request, ordered by
 * id since the table has no createdAt column.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { changeRequestMessages, users } from "@gc-stats/db";

// changeRequestMessages has no createdAt column (schema/content.ts) — id
// order is the only chronology available, which is fine for an append-only
// thread.
export type ChangeRequestMessageRow = {
  id: number;
  userId: string | null;
  username: string | null;
  type: string;
  body: string;
};

export async function listChangeRequestMessages(changeRequestId: number): Promise<ChangeRequestMessageRow[]> {
  const rows = await db
    .select({ id: changeRequestMessages.id, userId: changeRequestMessages.userId, username: users.username, type: changeRequestMessages.type, body: changeRequestMessages.body })
    .from(changeRequestMessages)
    .leftJoin(users, eq(users.id, changeRequestMessages.userId))
    .where(eq(changeRequestMessages.changeRequestId, changeRequestId))
    .orderBy(asc(changeRequestMessages.id));

  return rows;
}

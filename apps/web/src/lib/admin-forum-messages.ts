/**
 * GC-Stats - admin-forum-messages
 *
 * Admin queries for /admin/forum: paginated, filterable forum message
 * moderation list plus status counts, optionally scoped to one author.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { forumMessages, forumThreads, users } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import { resolveForumThreadLink } from "@/lib/forum-thread-link";

export const FORUM_MESSAGES_PAGE_SIZE = 30;

export type ForumMessageStatus = "visible" | "hidden" | "deleted";
export type ForumMessageSort = "createdAt" | "status";
export type SortDirection = "asc" | "desc";

export type AdminForumMessageRow = {
  id: number;
  threadId: number;
  threadTitle: string | null;
  threadCategory: string;
  userId: string | null;
  username: string | null;
  body: string;
  status: ForumMessageStatus;
  hiddenAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  link: string;
};

function statusCondition(status: ForumMessageStatus) {
  if (status === "hidden") return and(isNotNull(forumMessages.hiddenAt), isNull(forumMessages.deletedAt));
  if (status === "deleted") return isNotNull(forumMessages.deletedAt);
  return and(isNull(forumMessages.hiddenAt), isNull(forumMessages.deletedAt));
}

export async function listAdminForumMessages(opts: {
  q: string;
  status: ForumMessageStatus | "";
  sort: ForumMessageSort;
  direction: SortDirection;
  page: number;
  /** Restricts the listing to one author, e.g. the forum messages panel on /admin/users/{id}. */
  userId?: string;
  pageSize?: number;
}): Promise<{ rows: AdminForumMessageRow[]; total: number }> {
  const { q, status, sort, direction, page, userId, pageSize = FORUM_MESSAGES_PAGE_SIZE } = opts;

  const conditions = [];
  if (status) conditions.push(statusCondition(status));
  if (userId) conditions.push(eq(forumMessages.userId, userId));
  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = [...variants.map((v) => foldedIlike(forumMessages.body, v)), ...variants.map((v) => foldedIlike(users.username, v))];
    if (numeric) clauses.push(eq(forumMessages.id, Number(q)));
    conditions.push(or(...clauses));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "status" ? forumMessages.hiddenAt : forumMessages.createdAt;
  const orderBy = direction === "asc" ? asc(sortCol) : desc(sortCol);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: forumMessages.id,
        threadId: forumMessages.threadId,
        threadTitle: forumThreads.title,
        threadCategory: forumThreads.category,
        userId: forumMessages.userId,
        username: users.username,
        body: forumMessages.body,
        hiddenAt: forumMessages.hiddenAt,
        deletedAt: forumMessages.deletedAt,
        createdAt: forumMessages.createdAt,
      })
      .from(forumMessages)
      .leftJoin(forumThreads, eq(forumThreads.id, forumMessages.threadId))
      .leftJoin(users, eq(users.id, forumMessages.userId))
      .where(where)
      .orderBy(orderBy, desc(forumMessages.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(forumMessages)
      .leftJoin(users, eq(users.id, forumMessages.userId))
      .where(where),
  ]);
  const count = countRows[0]?.count ?? 0;
  const links = await Promise.all(rows.map((r) => resolveForumThreadLink(r.threadId, r.id)));

  return {
    rows: rows.map((r, i) => ({
      id: r.id,
      threadId: r.threadId,
      threadTitle: r.threadTitle,
      threadCategory: r.threadCategory ?? "general",
      userId: r.userId,
      username: r.username,
      body: r.body,
      status: r.deletedAt ? "deleted" : r.hiddenAt ? "hidden" : "visible",
      hiddenAt: r.hiddenAt ? r.hiddenAt.toISOString() : null,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      link: links[i]!,
    })),
    total: count,
  };
}

export async function getAdminForumMessageCounts(): Promise<{ visible: number; hidden: number; deleted: number }> {
  const [visible, hidden, deleted] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(forumMessages).where(statusCondition("visible")),
    db.select({ count: sql<number>`count(*)::int` }).from(forumMessages).where(statusCondition("hidden")),
    db.select({ count: sql<number>`count(*)::int` }).from(forumMessages).where(statusCondition("deleted")),
  ]);
  return { visible: visible[0]?.count ?? 0, hidden: hidden[0]?.count ?? 0, deleted: deleted[0]?.count ?? 0 };
}

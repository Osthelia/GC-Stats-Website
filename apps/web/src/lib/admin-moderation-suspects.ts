/**
 * GC-Stats - admin-moderation-suspects
 *
 * Admin queries for /admin/moderation: paginated, filterable list of
 * auto-flagged content and status counts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { moderationSuspects, users } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export const MODERATION_SUSPECTS_PAGE_SIZE = 30;

export type ModerationSuspectStatus = "pending" | "dismissed" | "actioned";
export type ModerationSuspectSort = "id" | "status" | "source";
export type SortDirection = "asc" | "desc";

export type AdminModerationSuspectRow = {
  id: number;
  source: string | null;
  subjectType: string | null;
  subjectId: number | null;
  threadId: number | null;
  userId: string | null;
  username: string | null;
  matchedTerm: string | null;
  bodySnapshot: string;
  status: ModerationSuspectStatus;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
};

export async function listAdminModerationSuspects(opts: {
  q: string;
  status: ModerationSuspectStatus | "";
  sort: ModerationSuspectSort;
  direction: SortDirection;
  page: number;
}): Promise<{ rows: AdminModerationSuspectRow[]; total: number }> {
  const { q, status, sort, direction, page } = opts;

  const conditions = [];
  if (status) conditions.push(eq(moderationSuspects.status, status));
  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = [
      ...variants.map((v) => foldedIlike(moderationSuspects.matchedTerm, v)),
      ...variants.map((v) => foldedIlike(moderationSuspects.bodySnapshot, v)),
      ...variants.map((v) => foldedIlike(moderationSuspects.source, v)),
    ];
    if (numeric) clauses.push(eq(moderationSuspects.id, Number(q)));
    conditions.push(or(...clauses));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "status" ? moderationSuspects.status : sort === "source" ? moderationSuspects.source : moderationSuspects.id;
  const orderBy = direction === "asc" ? asc(sortCol) : desc(sortCol);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: moderationSuspects.id,
        source: moderationSuspects.source,
        subjectType: moderationSuspects.subjectType,
        subjectId: moderationSuspects.subjectId,
        threadId: moderationSuspects.threadId,
        userId: moderationSuspects.userId,
        matchedTerm: moderationSuspects.matchedTerm,
        bodySnapshot: moderationSuspects.bodySnapshot,
        status: moderationSuspects.status,
        reviewedBy: moderationSuspects.reviewedBy,
        reviewedAt: moderationSuspects.reviewedAt,
      })
      .from(moderationSuspects)
      .where(where)
      .orderBy(orderBy, desc(moderationSuspects.id))
      .limit(MODERATION_SUSPECTS_PAGE_SIZE)
      .offset((page - 1) * MODERATION_SUSPECTS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(moderationSuspects).where(where),
  ]);
  const count = countRows[0]?.count ?? 0;

  const userIds = [...new Set(rows.flatMap((r) => [r.userId, r.reviewedBy]).filter((v): v is string => !!v))];
  const userRows = userIds.length ? await db.select({ id: users.id, username: users.username }).from(users).where(or(...userIds.map((id) => eq(users.id, id)))) : [];
  const usernameOf = new Map(userRows.map((u) => [u.id, u.username] as const));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      source: r.source,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      threadId: r.threadId,
      userId: r.userId,
      username: r.userId ? (usernameOf.get(r.userId) ?? null) : null,
      matchedTerm: r.matchedTerm,
      bodySnapshot: r.bodySnapshot,
      status: r.status as ModerationSuspectStatus,
      reviewedByUsername: r.reviewedBy ? (usernameOf.get(r.reviewedBy) ?? null) : null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    })),
    total: count,
  };
}

export async function getAdminModerationSuspectCounts(): Promise<{ pending: number; actioned: number; dismissed: number }> {
  const rows = await db.select({ status: moderationSuspects.status, count: sql<number>`count(*)::int` }).from(moderationSuspects).groupBy(moderationSuspects.status);
  const result = { pending: 0, actioned: 0, dismissed: 0 };
  for (const row of rows) {
    if (row.status === "pending") result.pending = row.count;
    else if (row.status === "actioned") result.actioned = row.count;
    else if (row.status === "dismissed") result.dismissed = row.count;
  }
  return result;
}

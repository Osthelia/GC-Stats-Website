/**
 * GC-Stats - admin-reports
 *
 * Admin queries for /admin/reports: paginated, filterable user report list
 * with resolved reporter, reported entity and reviewer names, plus status
 * counts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { userReports, users, forumMessages, emotes, organizations } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export const REPORTS_PAGE_SIZE = 30;

export type ReportStatus = "pending" | "resolved" | "dismissed";
export type ReportSort = "id" | "status" | "category";
export type SortDirection = "asc" | "desc";

export type AdminReportRow = {
  id: number;
  category: string;
  reason: string;
  reporterId: string | null;
  reporterUsername: string | null;
  reportedUserId: string | null;
  reportedUsername: string | null;
  reportedMessageId: number | null;
  reportedMessagePreview: string | null;
  reactableType: string | null;
  reactableId: number | null;
  emoteName: string | null;
  organizationName: string | null;
  status: ReportStatus;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
};

export async function listAdminReports(opts: {
  q: string;
  status: ReportStatus | "";
  sort: ReportSort;
  direction: SortDirection;
  page: number;
}): Promise<{ rows: AdminReportRow[]; total: number }> {
  const { q, status, sort, direction, page } = opts;

  const reporter = users;
  const conditions = [];
  if (status) conditions.push(eq(userReports.status, status));
  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = [...variants.map((v) => foldedIlike(userReports.reason, v)), ...variants.map((v) => foldedIlike(userReports.category, v))];
    if (numeric) clauses.push(eq(userReports.id, Number(q)));
    conditions.push(or(...clauses));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "status" ? userReports.status : sort === "category" ? userReports.category : userReports.id;
  const orderBy = direction === "asc" ? asc(sortCol) : desc(sortCol);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: userReports.id,
        category: userReports.category,
        reason: userReports.reason,
        reporterId: userReports.reporterId,
        reportedUserId: userReports.reportedUserId,
        reportedMessageId: userReports.reportedMessageId,
        reactableType: userReports.reactableType,
        reactableId: userReports.reactableId,
        emoteId: userReports.emoteId,
        organizationId: userReports.organizationId,
        status: userReports.status,
        reviewedBy: userReports.reviewedBy,
        reviewedAt: userReports.reviewedAt,
        resolutionNote: userReports.resolutionNote,
      })
      .from(userReports)
      .where(where)
      .orderBy(orderBy, desc(userReports.id))
      .limit(REPORTS_PAGE_SIZE)
      .offset((page - 1) * REPORTS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(userReports).where(where),
  ]);
  const count = countRows[0]?.count ?? 0;

  const userIds = [...new Set(rows.flatMap((r) => [r.reporterId, r.reportedUserId, r.reviewedBy]).filter((v): v is string => !!v))];
  const messageIds = [...new Set(rows.map((r) => r.reportedMessageId).filter((v): v is number => v != null))];
  const emoteIds = [...new Set(rows.map((r) => r.emoteId).filter((v): v is number => v != null))];
  const orgIds = [...new Set(rows.map((r) => r.organizationId).filter((v): v is number => v != null))];

  const [userRows, messageRows, emoteRows, orgRows] = await Promise.all([
    userIds.length ? db.select({ id: users.id, username: users.username }).from(reporter).where(or(...userIds.map((id) => eq(reporter.id, id)))) : [],
    messageIds.length ? db.select({ id: forumMessages.id, body: forumMessages.body }).from(forumMessages).where(or(...messageIds.map((id) => eq(forumMessages.id, id)))) : [],
    emoteIds.length ? db.select({ id: emotes.id, name: emotes.name }).from(emotes).where(or(...emoteIds.map((id) => eq(emotes.id, id)))) : [],
    orgIds.length ? db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(or(...orgIds.map((id) => eq(organizations.id, id)))) : [],
  ]);

  const usernameOf = new Map(userRows.map((u) => [u.id, u.username] as const));
  const messageOf = new Map(messageRows.map((m) => [m.id, m.body] as const));
  const emoteOf = new Map(emoteRows.map((e) => [e.id, e.name] as const));
  const orgOf = new Map(orgRows.map((o) => [o.id, o.name] as const));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      category: r.category,
      reason: r.reason,
      reporterId: r.reporterId,
      reporterUsername: r.reporterId ? (usernameOf.get(r.reporterId) ?? null) : null,
      reportedUserId: r.reportedUserId,
      reportedUsername: r.reportedUserId ? (usernameOf.get(r.reportedUserId) ?? null) : null,
      reportedMessageId: r.reportedMessageId,
      reportedMessagePreview: r.reportedMessageId ? (messageOf.get(r.reportedMessageId) ?? null) : null,
      reactableType: r.reactableType,
      reactableId: r.reactableId,
      emoteName: r.emoteId ? (emoteOf.get(r.emoteId) ?? null) : null,
      organizationName: r.organizationId ? (orgOf.get(r.organizationId) ?? null) : null,
      status: r.status as ReportStatus,
      reviewedByUsername: r.reviewedBy ? (usernameOf.get(r.reviewedBy) ?? null) : null,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      resolutionNote: r.resolutionNote,
    })),
    total: count,
  };
}

export async function getAdminReportCounts(): Promise<{ pending: number; resolved: number; dismissed: number }> {
  const rows = await db.select({ status: userReports.status, count: sql<number>`count(*)::int` }).from(userReports).groupBy(userReports.status);
  const result = { pending: 0, resolved: 0, dismissed: 0 };
  for (const row of rows) {
    if (row.status === "pending") result.pending = row.count;
    else if (row.status === "resolved") result.resolved = row.count;
    else if (row.status === "dismissed") result.dismissed = row.count;
  }
  return result;
}

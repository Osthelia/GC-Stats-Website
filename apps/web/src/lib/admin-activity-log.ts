/**
 * GC-Stats - admin-activity-log
 *
 * Admin queries for browsing the activity log: paginated, filterable search
 * by log name, event and free text, plus the distinct filter options.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { activityLog } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export const ACTIVITY_LOG_PAGE_SIZE = 40;

export type AdminActivityLogRow = {
  id: number;
  logName: string | null;
  description: string;
  subjectType: string | null;
  subjectId: string | null;
  event: string | null;
  causerType: string | null;
  causerId: number | null;
  attributeChanges: unknown;
  properties: unknown;
  createdAt: string;
};

export async function listAdminActivityLog(opts: { q: string; logName: string; event: string; page: number }): Promise<{ rows: AdminActivityLogRow[]; total: number }> {
  const { q, logName, event, page } = opts;

  const conditions = [];
  if (logName) conditions.push(eq(activityLog.logName, logName));
  if (event) conditions.push(eq(activityLog.event, event));
  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const clauses = [...variants.map((v) => foldedIlike(activityLog.description, v)), ...variants.map((v) => foldedIlike(activityLog.subjectType, v))];
    if (numeric) clauses.push(eq(activityLog.id, Number(q)));
    conditions.push(or(...clauses));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(ACTIVITY_LOG_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_LOG_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(activityLog).where(where),
  ]);
  const count = countRows[0]?.count ?? 0;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      logName: r.logName,
      description: r.description,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      event: r.event,
      causerType: r.causerType,
      causerId: r.causerId,
      attributeChanges: r.attributeChanges,
      properties: r.properties,
      createdAt: r.createdAt.toISOString(),
    })),
    total: count,
  };
}

export async function getAdminActivityLogFilterOptions(): Promise<{ logNames: string[]; events: string[] }> {
  const [logNameRows, eventRows] = await Promise.all([
    db.selectDistinct({ logName: activityLog.logName }).from(activityLog),
    db.selectDistinct({ event: activityLog.event }).from(activityLog),
  ]);
  return {
    logNames: logNameRows.map((r) => r.logName).filter((v): v is string => !!v).sort(),
    events: eventRows.map((r) => r.event).filter((v): v is string => !!v).sort(),
  };
}

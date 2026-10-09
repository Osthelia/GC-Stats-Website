/**
 * GC-Stats - organization-activity-log
 *
 * Dashboard queries for an organization's own activity log: paginated and
 * filterable by subject, event and free text, scoped to that organization.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { activityLog, users } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export const ORG_ACTIVITY_LOG_PAGE_SIZE = 30;

export type OrgActivityLogRow = {
  id: number;
  description: string;
  subjectType: string | null;
  subjectId: string | null;
  event: string | null;
  actorUsername: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
};

/** An entry belongs to an organization when it targets it directly or carries its id in properties.organizationId (players, news, streams, etc. edited on its behalf). */
function organizationScope(organizationId: number) {
  return or(
    and(eq(activityLog.subjectType, "organization"), eq(activityLog.subjectId, String(organizationId))),
    sql`(${activityLog.properties}->>'organizationId') = ${String(organizationId)}`
  );
}

function actorIdOf(properties: unknown): string | null {
  const id = properties !== null && typeof properties === "object" ? (properties as Record<string, unknown>).actorUserId : null;
  return typeof id === "string" ? id : null;
}

export async function listOrganizationActivityLog(organizationId: number, opts: { q: string; subject: string; event: string; page: number }): Promise<{ rows: OrgActivityLogRow[]; total: number }> {
  const { q, subject, event, page } = opts;

  const conditions = [organizationScope(organizationId)];
  if (subject) conditions.push(eq(activityLog.subjectType, subject));
  if (event) conditions.push(eq(activityLog.event, event));
  if (q) conditions.push(or(...typoVariants(q.toLowerCase()).map((v) => foldedIlike(activityLog.description, v))));
  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(ORG_ACTIVITY_LOG_PAGE_SIZE)
      .offset((page - 1) * ORG_ACTIVITY_LOG_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(activityLog).where(where),
  ]);

  const actorIds = [...new Set(rows.map((r) => actorIdOf(r.properties)).filter((id): id is string => !!id))];
  const actorRows = actorIds.length ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, actorIds)) : [];
  const usernameById = new Map(actorRows.map((u) => [u.id, u.username]));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      description: r.description,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      event: r.event,
      actorUsername: usernameById.get(actorIdOf(r.properties) ?? "") ?? null,
      changes: r.attributeChanges && typeof r.attributeChanges === "object" ? (r.attributeChanges as OrgActivityLogRow["changes"]) : null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: countRows[0]?.count ?? 0,
  };
}

/** Subject types and events actually present in this organization's log, to build the filter selects. */
export async function getOrganizationActivityLogFilterOptions(organizationId: number): Promise<{ subjects: string[]; events: string[] }> {
  const where = organizationScope(organizationId);
  const [subjectRows, eventRows] = await Promise.all([
    db.selectDistinct({ subjectType: activityLog.subjectType }).from(activityLog).where(where),
    db.selectDistinct({ event: activityLog.event }).from(activityLog).where(where),
  ]);
  return {
    subjects: subjectRows.map((r) => r.subjectType).filter((v): v is string => !!v).sort(),
    events: eventRows.map((r) => r.event).filter((v): v is string => !!v).sort(),
  };
}

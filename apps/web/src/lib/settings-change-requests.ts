/**
 * GC-Stats - settings-change-requests
 *
 * Backs the "My change requests" tab in account settings: a user's own
 * change requests, paginated, plus an ownership-checked detail lookup that
 * reuses the admin detail query.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { changeRequests } from "@gc-stats/db";
import type { ChangeRequestSubjectType } from "@/lib/change-request-fields";
import { subjectLabels, getAdminChangeRequestDetail, type ChangeRequestStatus, type AdminChangeRequestDetail } from "@/lib/admin-change-requests";

export const MY_CHANGE_REQUESTS_PAGE_SIZE = 20;

export type MyChangeRequestRow = {
  id: number;
  subjectType: ChangeRequestSubjectType;
  subjectId: number;
  subjectLabel: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
};

export async function listOwnChangeRequests(userId: string, page: number): Promise<{ rows: MyChangeRequestRow[]; totalPages: number }> {
  const where = eq(changeRequests.requestedBy, userId);

  const [rows, countRows] = await Promise.all([
    db
      .select({ id: changeRequests.id, subjectType: changeRequests.subjectType, subjectId: changeRequests.subjectId, status: changeRequests.status, createdAt: changeRequests.createdAt })
      .from(changeRequests)
      .where(where)
      .orderBy(desc(changeRequests.id))
      .limit(MY_CHANGE_REQUESTS_PAGE_SIZE)
      .offset((page - 1) * MY_CHANGE_REQUESTS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(changeRequests).where(where),
  ]);

  const teamIds = rows.filter((r) => r.subjectType === "team").map((r) => r.subjectId);
  const personIds = rows.filter((r) => r.subjectType === "person").map((r) => r.subjectId);
  const [teamLabels, personLabels] = await Promise.all([subjectLabels("team", teamIds), subjectLabels("person", personIds)]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      subjectType: r.subjectType as ChangeRequestSubjectType,
      subjectId: r.subjectId,
      subjectLabel: (r.subjectType === "team" ? teamLabels : personLabels).get(r.subjectId) ?? null,
      status: r.status as ChangeRequestStatus,
      createdAt: r.createdAt.toISOString(),
    })),
    totalPages: Math.max(1, Math.ceil((countRows[0]?.count ?? 0) / MY_CHANGE_REQUESTS_PAGE_SIZE)),
  };
}

/** Ownership-checked before reusing the admin detail query — never a 403 that would confirm the id exists to someone else. */
export async function getMyChangeRequestDetail(userId: string, id: number): Promise<AdminChangeRequestDetail | null> {
  const [row] = await db.select({ requestedBy: changeRequests.requestedBy }).from(changeRequests).where(eq(changeRequests.id, id)).limit(1);
  if (!row || row.requestedBy !== userId) return null;

  return getAdminChangeRequestDetail(id);
}

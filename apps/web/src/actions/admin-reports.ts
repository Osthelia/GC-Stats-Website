/**
 * GC-Stats - admin-reports
 *
 * Admin server actions for reviewing user reports. Every resolve/dismiss
 * requires a note explaining the decision, and notifies the reporter.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { userReports, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import type { ReportStatus } from "@/lib/admin-reports";
import { notify } from "@/lib/notify";

export type ReportFieldErrors = { note?: string };
export type ReportResult = { ok: true } | { ok: false; fieldErrors: ReportFieldErrors };

/**
 * Every review action (resolve/dismiss) requires a note explaining the
 * decision — mirrors the "changes requested needs a comment" rule already
 * used by the news review workflow, so a status change is never left
 * unexplained for whoever reads it later.
 */
export async function resolveReport(id: number, status: "resolved" | "dismissed", note: string): Promise<ReportResult> {
  const access = await requireActorPermission(PERMISSIONS.reportsManage);

  const trimmedNote = note.trim();
  if (trimmedNote.length < 3) return { ok: false, fieldErrors: { note: "required" } };
  if (trimmedNote.length > 2000) return { ok: false, fieldErrors: { note: "tooLong" } };

  const [existing] = await db.select({ id: userReports.id, reporterId: userReports.reporterId }).from(userReports).where(eq(userReports.id, id)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { note: "notFound" } };

  await db
    .update(userReports)
    .set({ status, resolutionNote: trimmedNote, reviewedBy: access.userId, reviewedAt: new Date() })
    .where(eq(userReports.id, id));

  if (existing.reporterId) {
    await notify({ recipientId: existing.reporterId, type: "report.resolved", authorId: access.userId, data: { reportId: id, status } });
  }

  return { ok: true };
}

export async function reopenReport(id: number): Promise<ReportResult> {
  await requireActorPermission(PERMISSIONS.reportsManage);

  const [existing] = await db.select({ id: userReports.id }).from(userReports).where(eq(userReports.id, id)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { note: "notFound" } };

  await db.update(userReports).set({ status: "pending" as ReportStatus, resolutionNote: null, reviewedBy: null, reviewedAt: null }).where(eq(userReports.id, id));
  return { ok: true };
}

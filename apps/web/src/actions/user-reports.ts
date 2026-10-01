/**
 * GC-Stats - user-reports
 *
 * Server action for reporting a user (as opposed to a forum message), rate
 * limited the same way as forum reports.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users, userReports } from "@gc-stats/db";
import { auth } from "@/auth";
import { canSubmitReport } from "@/lib/forum-guards";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/report-categories";

export type ActionResult = { ok: true } | { ok: false; error: string };

const REASON_MAX_LENGTH = 500;

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** Generic "report this user" (mirrors reportForumMessage in actions/forum.ts, but targets reportedUserId instead of reportedMessageId). */
export async function reportUser(input: { userId: string; category: ReportCategory; reason: string }): Promise<ActionResult> {
  const reporterId = await requireUserId();

  if (reporterId === input.userId) return { ok: false, error: "cannotReportSelf" };
  if (!(REPORT_CATEGORIES as readonly string[]).includes(input.category)) return { ok: false, error: "invalidCategory" };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "reasonRequired" };
  if (reason.length > REASON_MAX_LENGTH) return { ok: false, error: "reasonTooLong" };

  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target) return { ok: false, error: "notFound" };

  if (!(await canSubmitReport(reporterId))) return { ok: false, error: "rateLimited" };

  await db.insert(userReports).values({ reporterId, reportedUserId: input.userId, category: input.category, reason });
  return { ok: true };
}

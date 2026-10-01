/**
 * GC-Stats - admin-moderation
 *
 * Admin server action for resolving flagged moderation suspects
 * (dismiss/action), recording who reviewed it and when.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { moderationSuspects, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";

export type ModerationSuspectResult = { ok: true } | { ok: false; error: "notFound" };

export async function resolveModerationSuspect(id: number, status: "dismissed" | "actioned"): Promise<ModerationSuspectResult> {
  const access = await requireActorPermission(PERMISSIONS.moderationManage);

  const [existing] = await db.select({ id: moderationSuspects.id }).from(moderationSuspects).where(eq(moderationSuspects.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.update(moderationSuspects).set({ status, reviewedBy: access.userId, reviewedAt: new Date() }).where(eq(moderationSuspects.id, id));
  return { ok: true };
}

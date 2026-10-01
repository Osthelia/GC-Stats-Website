/**
 * GC-Stats - notifications
 *
 * Server actions marking a user's own notifications as read (single or
 * all).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { auth } from "@/auth";
import { markAllRead, markRead } from "@/lib/notify";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const userId = await requireUserId();
  await markAllRead(userId);
  return { ok: true };
}

export async function markNotificationRead(notificationId: number): Promise<ActionResult> {
  const userId = await requireUserId();
  const found = await markRead(notificationId, userId);
  if (!found) return { ok: false, error: "notFound" };
  return { ok: true };
}

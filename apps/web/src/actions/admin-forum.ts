/**
 * GC-Stats - admin-forum
 *
 * Admin server actions for forum moderation: hide/unhide and soft
 * delete/restore of forum messages.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { forumMessages, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";

export type ForumMessageResult = { ok: true } | { ok: false; error: "notFound" };

async function requireForumActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.forumManage);
}

async function findMessage(id: number) {
  const [row] = await db.select({ id: forumMessages.id }).from(forumMessages).where(eq(forumMessages.id, id)).limit(1);
  return row;
}

export async function hideForumMessage(id: number): Promise<ForumMessageResult> {
  await requireForumActor();
  if (!(await findMessage(id))) return { ok: false, error: "notFound" };
  await db.update(forumMessages).set({ hiddenAt: new Date() }).where(eq(forumMessages.id, id));
  return { ok: true };
}

export async function unhideForumMessage(id: number): Promise<ForumMessageResult> {
  await requireForumActor();
  if (!(await findMessage(id))) return { ok: false, error: "notFound" };
  await db.update(forumMessages).set({ hiddenAt: null }).where(eq(forumMessages.id, id));
  return { ok: true };
}

export async function deleteForumMessage(id: number): Promise<ForumMessageResult> {
  await requireForumActor();
  if (!(await findMessage(id))) return { ok: false, error: "notFound" };
  await db.update(forumMessages).set({ deletedAt: new Date() }).where(eq(forumMessages.id, id));
  return { ok: true };
}

export async function restoreForumMessage(id: number): Promise<ForumMessageResult> {
  await requireForumActor();
  if (!(await findMessage(id))) return { ok: false, error: "notFound" };
  await db.update(forumMessages).set({ deletedAt: null }).where(eq(forumMessages.id, id));
  return { ok: true };
}

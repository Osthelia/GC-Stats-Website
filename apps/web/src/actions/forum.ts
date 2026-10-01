/**
 * GC-Stats - forum
 *
 * Public-facing server actions for the forum: thread/message creation,
 * replies, reports, mention notifications and auto-moderation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { after } from "next/server";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { forumMessages, forumThreads, users, userReports } from "@gc-stats/db";
import { auth } from "@/auth";
import { assertCanPostToForum, canCreateThread, canPostMessage, canSubmitReport } from "@/lib/forum-guards";
import { moderateForumMessage } from "@/lib/forum-automod";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/report-categories";
import { resolveMentionedUserIds } from "@/lib/forum-mentions";
import { resolveForumThreadLink } from "@/lib/forum-thread-link";
import { notify } from "@/lib/notify";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import { excerpt } from "@/lib/text-excerpt";

const TITLE_MAX_LENGTH = 150;
const BODY_MAX_LENGTH = 5000;
const REPLY_MAX_LENGTH = 3000;
const REASON_MAX_LENGTH = 500;

export type ForumActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** Notifies a replied-to author and any `@username` mentions, never the poster themselves and never the same recipient twice for one message. */
async function notifyForumMessage(input: { threadId: number; messageId: number; authorId: string; body: string; parentAuthorId?: string | null; parentBody?: string | null }): Promise<void> {
  const notified = new Set<string>([input.authorId]);
  const link = await resolveForumThreadLink(input.threadId, input.messageId);
  const replyExcerpt = excerpt(input.body);

  if (input.parentAuthorId && !notified.has(input.parentAuthorId)) {
    notified.add(input.parentAuthorId);
    const data: Record<string, unknown> = { messageId: input.messageId, replyExcerpt };
    if (input.parentBody) data.sourceExcerpt = excerpt(input.parentBody);
    await notify({ recipientId: input.parentAuthorId, type: "forum.reply", authorId: input.authorId, link, data });
  }

  const mentionedIds = await resolveMentionedUserIds(input.body, notified);
  for (const recipientId of mentionedIds) {
    await notify({ recipientId, type: "forum.mention", authorId: input.authorId, link, data: { messageId: input.messageId, replyExcerpt } });
  }
}

/** Autocomplete backing the forum's inline `@mention` composer — open to any authenticated account, not admin-gated like lib/user-search.ts (any forum poster can mention anyone). */
export async function searchForumMentionUsers(query: string): Promise<{ id: string; username: string | null; image: string | null }[]> {
  await requireUserId();
  const q = query.trim();
  if (!q) return [];

  const variants = typoVariants(q.toLowerCase());
  return db
    .select({ id: users.id, username: users.username, image: users.image })
    .from(users)
    .where(and(or(...variants.map((v) => foldedIlike(users.username, v))), ne(users.username, "")))
    .orderBy(users.username)
    .limit(6);
}

export async function acceptForumRules(): Promise<ForumActionResult> {
  const userId = await requireUserId();
  await db.update(users).set({ forumRulesAcceptedAt: new Date() }).where(eq(users.id, userId));
  return { ok: true };
}

export async function createGeneralThread(input: { title: string; body: string }): Promise<ForumActionResult<{ threadId: number }>> {
  const userId = await requireUserId();

  const guardError = await assertCanPostToForum(userId);
  if (guardError) return { ok: false, error: guardError };
  if (!(await canCreateThread(userId))) return { ok: false, error: "rateLimited" };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, error: "titleRequired" };
  if (title.length > TITLE_MAX_LENGTH) return { ok: false, error: "titleTooLong" };
  if (!body) return { ok: false, error: "bodyRequired" };
  if (body.length > BODY_MAX_LENGTH) return { ok: false, error: "bodyTooLong" };

  const now = new Date();
  const { threadId, messageId } = await db.transaction(async (tx) => {
    const [thread] = await tx
      .insert(forumThreads)
      .values({ category: "general", title, createdBy: userId, lastMessageAt: now })
      .returning({ id: forumThreads.id });
    const [message] = await tx
      .insert(forumMessages)
      .values({ threadId: thread!.id, userId, body, createdAt: now })
      .returning({ id: forumMessages.id });
    return { threadId: thread!.id, messageId: message!.id };
  });

  after(() => moderateForumMessage(messageId, `${title}\n\n${body}`));
  after(() => notifyForumMessage({ threadId, messageId, authorId: userId, body }));

  return { ok: true, threadId };
}

export async function postForumMessage(input: { threadId: number; body: string; parentId?: number | null }): Promise<ForumActionResult<{ messageId: number }>> {
  const userId = await requireUserId();

  const guardError = await assertCanPostToForum(userId);
  if (guardError) return { ok: false, error: guardError };

  const [thread] = await db.select({ id: forumThreads.id }).from(forumThreads).where(eq(forumThreads.id, input.threadId)).limit(1);
  if (!thread) return { ok: false, error: "notFound" };

  if (!(await canPostMessage(userId, input.threadId))) return { ok: false, error: "rateLimited" };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "bodyRequired" };
  if (body.length > REPLY_MAX_LENGTH) return { ok: false, error: "bodyTooLong" };

  let parentId: number | null = null;
  let parentAuthorId: string | null = null;
  let parentBody: string | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: forumMessages.id, userId: forumMessages.userId, body: forumMessages.body })
      .from(forumMessages)
      .where(and(eq(forumMessages.id, input.parentId), eq(forumMessages.threadId, input.threadId), isNull(forumMessages.deletedAt)))
      .limit(1);
    if (!parent) return { ok: false, error: "invalidParent" };
    parentId = parent.id;
    parentAuthorId = parent.userId;
    parentBody = parent.body;
  }

  const now = new Date();
  const messageId = await db.transaction(async (tx) => {
    const [message] = await tx.insert(forumMessages).values({ threadId: input.threadId, userId, parentId, body, createdAt: now }).returning({ id: forumMessages.id });
    await tx.update(forumThreads).set({ lastMessageAt: now }).where(eq(forumThreads.id, input.threadId));
    return message!.id;
  });

  after(() => moderateForumMessage(messageId, body));
  after(() => notifyForumMessage({ threadId: input.threadId, messageId, authorId: userId, body, parentAuthorId, parentBody }));

  return { ok: true, messageId };
}

export async function reportForumMessage(input: { messageId: number; category: ReportCategory; reason: string }): Promise<ForumActionResult> {
  const userId = await requireUserId();

  if (!(REPORT_CATEGORIES as readonly string[]).includes(input.category)) return { ok: false, error: "invalidCategory" };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "reasonRequired" };
  if (reason.length > REASON_MAX_LENGTH) return { ok: false, error: "reasonTooLong" };

  const [message] = await db.select({ id: forumMessages.id }).from(forumMessages).where(eq(forumMessages.id, input.messageId)).limit(1);
  if (!message) return { ok: false, error: "notFound" };

  if (!(await canSubmitReport(userId))) return { ok: false, error: "rateLimited" };

  await db.insert(userReports).values({ reporterId: userId, reportedMessageId: message.id, category: input.category, reason });
  return { ok: true };
}

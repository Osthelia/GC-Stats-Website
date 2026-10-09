/**
 * GC-Stats - forum-data
 *
 * Read queries for the general forum: overview stats, paginated threads,
 * thread detail, and paginated messages with reactions/parent previews
 * attached in batch.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { forumMessages, forumThreads, users } from "@gc-stats/db";
import { getReactionSummaries, type ReactionSummary } from "@/lib/reactions";
import { getUserFanTeam, getUserFanTeamsBatch, type UserFanTeam } from "@/lib/user-profile-data";

const PARENT_PREVIEW_LENGTH = 140;

export const FORUM_THREADS_PAGE_SIZE = 20;
export const FORUM_MESSAGES_PAGE_SIZE = 20;
export const FORUM_OVERVIEW_THREAD_COUNT = 10;

export type ForumThreadSummary = {
  id: number;
  title: string;
  authorId: string | null;
  authorUsername: string | null;
  authorImage: string | null;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
};

const visibleMessage = () => and(isNull(forumMessages.hiddenAt), isNull(forumMessages.deletedAt));

async function attachThreadStats(threads: { id: number; title: string | null; createdBy: string | null; lastMessageAt: Date | null; authorUsername: string | null; authorImage: string | null }[]): Promise<ForumThreadSummary[]> {
  if (threads.length === 0) return [];
  const ids = threads.map((t) => t.id);

  const stats = await db
    .select({
      threadId: forumMessages.threadId,
      count: sql<number>`count(*)::int`,
      createdAt: sql<string>`min(${forumMessages.createdAt}) filter (where ${forumMessages.parentId} is null)`,
    })
    .from(forumMessages)
    .where(and(inArray(forumMessages.threadId, ids), visibleMessage()))
    .groupBy(forumMessages.threadId);

  const statsByThread = new Map(stats.map((s) => [s.threadId, s] as const));

  return threads.map((t) => {
    const s = statsByThread.get(t.id);
    return {
      id: t.id,
      title: t.title ?? "",
      authorId: t.createdBy,
      authorUsername: t.authorUsername,
      authorImage: t.authorImage,
      createdAt: s?.createdAt ?? (t.lastMessageAt ? t.lastMessageAt.toISOString() : new Date().toISOString()),
      lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : new Date().toISOString(),
      messageCount: s?.count ?? 0,
    };
  });
}

export async function getForumOverview(): Promise<{ totalThreads: number; totalMessages: number; latestThreads: ForumThreadSummary[] }> {
  const [threadCountRow, messageCountRow, latest] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(forumThreads).where(eq(forumThreads.category, "general")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(forumMessages)
      .innerJoin(forumThreads, eq(forumThreads.id, forumMessages.threadId))
      .where(and(visibleMessage(), eq(forumThreads.category, "general"))),
    db
      .select({
        id: forumThreads.id,
        title: forumThreads.title,
        createdBy: forumThreads.createdBy,
        lastMessageAt: forumThreads.lastMessageAt,
        authorUsername: users.username,
        authorImage: users.image,
      })
      .from(forumThreads)
      .leftJoin(users, eq(users.id, forumThreads.createdBy))
      .where(eq(forumThreads.category, "general"))
      .orderBy(desc(forumThreads.lastMessageAt))
      .limit(FORUM_OVERVIEW_THREAD_COUNT),
  ]);

  return {
    totalThreads: threadCountRow[0]?.count ?? 0,
    totalMessages: messageCountRow[0]?.count ?? 0,
    latestThreads: await attachThreadStats(latest),
  };
}

export async function getForumThreadsPage(page: number): Promise<{ threads: ForumThreadSummary[]; total: number }> {
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: forumThreads.id,
        title: forumThreads.title,
        createdBy: forumThreads.createdBy,
        lastMessageAt: forumThreads.lastMessageAt,
        authorUsername: users.username,
        authorImage: users.image,
      })
      .from(forumThreads)
      .leftJoin(users, eq(users.id, forumThreads.createdBy))
      .where(eq(forumThreads.category, "general"))
      .orderBy(desc(forumThreads.lastMessageAt))
      .limit(FORUM_THREADS_PAGE_SIZE)
      .offset((page - 1) * FORUM_THREADS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(forumThreads).where(eq(forumThreads.category, "general")),
  ]);

  return { threads: await attachThreadStats(rows), total: countRows[0]?.count ?? 0 };
}

export type ForumThreadDetail = {
  id: number;
  title: string;
  category: string;
  authorId: string | null;
  authorUsername: string | null;
  authorPronouns: number | null;
  authorFanTeam: UserFanTeam | null;
};

export const getForumThread = cache(async (threadId: number): Promise<ForumThreadDetail | null> => {
  const [row] = await db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      category: forumThreads.category,
      authorId: forumThreads.createdBy,
      authorUsername: users.username,
      authorPronouns: users.pronouns,
    })
    .from(forumThreads)
    .leftJoin(users, eq(users.id, forumThreads.createdBy))
    .where(eq(forumThreads.id, threadId))
    .limit(1);
  if (!row) return null;

  const authorFanTeam = row.authorId ? await getUserFanTeam(row.authorId) : null;
  return { ...row, title: row.title ?? "", authorFanTeam };
});

export type ForumMessageView = {
  id: number;
  authorId: string | null;
  authorUsername: string | null;
  authorImage: string | null;
  authorPronouns: number | null;
  authorFanTeam: UserFanTeam | null;
  body: string;
  createdAt: string;
  reactions: ReactionSummary[];
  parentId: number | null;
  // False when the parent message was hidden/deleted after this reply was posted.
  parentAvailable: boolean;
  // Independent of parentAvailable — the parent's author account can be deleted while its message still shows.
  parentAuthorUsername: string | null;
  parentPreview: string | null;
};

export async function getForumMessagesPage(threadId: number, page: number, userId: string | null): Promise<{ messages: ForumMessageView[]; total: number }> {
  const parentMessages = alias(forumMessages, "parent_messages");
  const parentUsers = alias(users, "parent_users");

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: forumMessages.id,
        authorId: forumMessages.userId,
        authorUsername: users.username,
        authorImage: users.image,
        authorPronouns: users.pronouns,
        body: forumMessages.body,
        createdAt: forumMessages.createdAt,
        parentId: forumMessages.parentId,
        parentBody: parentMessages.body,
        parentHiddenAt: parentMessages.hiddenAt,
        parentDeletedAt: parentMessages.deletedAt,
        parentAuthorUsername: parentUsers.username,
      })
      .from(forumMessages)
      .leftJoin(users, eq(users.id, forumMessages.userId))
      .leftJoin(parentMessages, eq(parentMessages.id, forumMessages.parentId))
      .leftJoin(parentUsers, eq(parentUsers.id, parentMessages.userId))
      .where(and(eq(forumMessages.threadId, threadId), visibleMessage()))
      .orderBy(forumMessages.createdAt)
      .limit(FORUM_MESSAGES_PAGE_SIZE)
      .offset((page - 1) * FORUM_MESSAGES_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(forumMessages).where(and(eq(forumMessages.threadId, threadId), visibleMessage())),
  ]);

  const [reactionsByMessage, fanTeamsByAuthor] = await Promise.all([
    getReactionSummaries(
      "forum_message",
      rows.map((r) => r.id),
      userId
    ),
    getUserFanTeamsBatch(rows.map((r) => r.authorId).filter((id): id is string => id !== null)),
  ]);

  return {
    messages: rows.map((r) => {
      const parentAvailable = !!r.parentId && !r.parentHiddenAt && !r.parentDeletedAt;
      const parentPreview = parentAvailable && r.parentBody ? (r.parentBody.length > PARENT_PREVIEW_LENGTH ? `${r.parentBody.slice(0, PARENT_PREVIEW_LENGTH)}…` : r.parentBody) : null;
      return {
        id: r.id,
        authorId: r.authorId,
        authorUsername: r.authorUsername,
        authorImage: r.authorImage,
        authorPronouns: r.authorPronouns,
        authorFanTeam: r.authorId ? (fanTeamsByAuthor.get(r.authorId) ?? null) : null,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        reactions: reactionsByMessage.get(r.id) ?? [],
        parentId: r.parentId,
        parentAvailable,
        parentAuthorUsername: parentAvailable ? r.parentAuthorUsername : null,
        parentPreview,
      };
    }),
    total: countRows[0]?.count ?? 0,
  };
}

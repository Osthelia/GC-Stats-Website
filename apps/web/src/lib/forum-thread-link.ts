/**
 * GC-Stats - forum-thread-link
 *
 * Resolves the public URL of a forum thread for use in notification links. A
 * "general" thread has its own route; a linked thread (match/news/tournament)
 * is only ever embedded on that subject's page, so this points there instead.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { forumThreads, gameTables } from "@gc-stats/db";
import { isGameSlug } from "@gc-stats/db/game";

/**
 * Public URL for a thread, for notification links. A "general" thread has
 * its own standalone route; a linked thread (match/news/tournament) is only
 * ever embedded on that subject's own page (see forum-thread-panel.tsx
 * callers), so the notification has to point there instead. Tournament/team
 * slugs are cosmetic only (lib/entity-id.ts), a placeholder works.
 */
export async function resolveForumThreadLink(threadId: number, messageId: number): Promise<string> {
  const [thread] = await db
    .select({ category: forumThreads.category, subjectType: forumThreads.subjectType, subjectId: forumThreads.subjectId, game: forumThreads.game })
    .from(forumThreads)
    .where(eq(forumThreads.id, threadId))
    .limit(1);

  const anchor = `#message-${messageId}`;
  if (!thread) return "/forum";
  const game = thread.game;
  if (!isGameSlug(game)) return `/forum/threads/${threadId}${anchor}`;

  if (thread.subjectType === "match" && thread.subjectId) return `/${game}/match/${thread.subjectId}${anchor}`;
  if (thread.subjectType === "tournament" && thread.subjectId) return `/${game}/tournaments/${thread.subjectId}/discussion${anchor}`;

  if (thread.subjectType === "news" && thread.subjectId) {
    const { news } = gameTables(game);
    const [article] = await db.select({ slug: news.slug }).from(news).where(eq(news.id, thread.subjectId)).limit(1);
    if (article) return `/${game}/news/${article.slug}${anchor}`;
  }

  return `/forum/threads/${threadId}${anchor}`;
}

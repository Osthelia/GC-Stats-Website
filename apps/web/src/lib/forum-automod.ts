/**
 * GC-Stats - forum-automod
 *
 * Runs OpenAI moderation on a forum message after the response is sent (see
 * `after()` calls in actions/forum.ts), hides flagged messages, and issues an
 * automatic mute once a user crosses the flag threshold.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { forumMessages, moderationSuspects } from "@gc-stats/db";
import { checkTextModeration } from "@/lib/openai-moderation";
import { issueAutomodMute, AUTOMOD_MUTE_FLAG_INTERVAL } from "@/lib/forum-guards";

/**
 * Runs after the response is sent (see `after()` calls in actions/forum.ts),
 * so an OpenAI round-trip never delays a post. Mirrors V1's
 * ModerateForumMessage job, dispatched with dispatchAfterResponse().
 */
export async function moderateForumMessage(messageId: number, checkText: string): Promise<void> {
  const result = await checkTextModeration(checkText);
  if (!result.flagged) return;

  const [message] = await db
    .select({ id: forumMessages.id, threadId: forumMessages.threadId, userId: forumMessages.userId })
    .from(forumMessages)
    .where(eq(forumMessages.id, messageId))
    .limit(1);
  if (!message) return;

  await db.update(forumMessages).set({ hiddenAt: new Date() }).where(eq(forumMessages.id, messageId));

  await db.insert(moderationSuspects).values({
    source: "openai",
    subjectType: "forum_message",
    subjectId: message.id,
    threadId: message.threadId,
    userId: message.userId,
    matchedTerm: result.categories.join(", "),
    bodySnapshot: checkText,
  });

  if (!message.userId) return;

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(moderationSuspects)
    .where(eq(moderationSuspects.userId, message.userId));
  const count = row?.count ?? 0;

  if (count > 0 && count % AUTOMOD_MUTE_FLAG_INTERVAL === 0) {
    await issueAutomodMute(message.userId, `Automod: ${count} flagged forum messages`);
  }
}

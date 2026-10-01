/**
 * GC-Stats - reactions
 *
 * Server action toggling emote reactions on forum messages, with
 * notification to the reacted-to author. Reuses the forum posting guard so
 * a muted/suspended account cannot farm reactions either.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { reactions, emotes, forumMessages } from "@gc-stats/db";
import { auth } from "@/auth";
import { assertCanPostToForum, type PostGuardError } from "@/lib/forum-guards";
import { REACTABLE_TYPES, getReactionSummary, type ReactableType, type ReactionSummary } from "@/lib/reactions";
import { notify } from "@/lib/notify";
import { resolveForumThreadLink } from "@/lib/forum-thread-link";
import { excerpt } from "@/lib/text-excerpt";

export type ReactionActionResult = ({ ok: true; reactions: ReactionSummary[] }) | { ok: false; error: PostGuardError | "guest" | "invalidType" | "invalidEmote" | "notFound" };

async function findReactableForumMessage(reactableType: ReactableType, reactableId: number): Promise<{ id: number; userId: string | null; threadId: number; body: string } | null> {
  if (reactableType !== "forum_message") return null;
  const [row] = await db
    .select({ id: forumMessages.id, userId: forumMessages.userId, threadId: forumMessages.threadId, body: forumMessages.body })
    .from(forumMessages)
    .where(eq(forumMessages.id, reactableId))
    .limit(1);
  return row ?? null;
}

/** Notifies the reacted-to message's author, never the reactor themselves, never a deleted account, and only when the reaction is added (not removed). */
async function notifyForumReaction(input: { message: { id: number; userId: string | null; threadId: number; body: string }; actorId: string; emoteName: string; emoteImageUrl: string }): Promise<void> {
  if (!input.message.userId || input.message.userId === input.actorId) return;
  const link = await resolveForumThreadLink(input.message.threadId, input.message.id);
  await notify({
    recipientId: input.message.userId,
    type: "forum.reaction",
    authorId: input.actorId,
    link,
    data: { messageId: input.message.id, sourceExcerpt: excerpt(input.message.body), emoteName: input.emoteName, emoteImageUrl: input.emoteImageUrl },
  });
}

/** Reacting reuses the same forum participation guard as posting (assertCanPostToForum), since a muted/suspended account shouldn't be able to farm reactions either. */
export async function toggleReaction(input: { reactableType: ReactableType; reactableId: number; emoteId: number }): Promise<ReactionActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "guest" };

  if (!(REACTABLE_TYPES as readonly string[]).includes(input.reactableType)) return { ok: false, error: "invalidType" };

  const guardError = await assertCanPostToForum(userId);
  if (guardError) return { ok: false, error: guardError };

  const [emote] = await db.select({ id: emotes.id, name: emotes.name, imagePath: emotes.imagePath }).from(emotes).where(and(eq(emotes.id, input.emoteId), eq(emotes.isActive, true))).limit(1);
  if (!emote) return { ok: false, error: "invalidEmote" };

  const message = await findReactableForumMessage(input.reactableType, input.reactableId);
  if (!message) return { ok: false, error: "notFound" };

  const [existing] = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(
      and(
        eq(reactions.reactableType, input.reactableType),
        eq(reactions.reactableId, input.reactableId),
        eq(reactions.userId, userId),
        eq(reactions.emoteId, input.emoteId)
      )
    )
    .limit(1);

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
  } else {
    // onConflictDoNothing absorbs a concurrent toggle on the same reaction (double click, two tabs)
    // racing this check-then-act, which would otherwise hit the unique constraint on the second insert.
    const [inserted] = await db
      .insert(reactions)
      .values({ reactableType: input.reactableType, reactableId: input.reactableId, userId, emoteId: input.emoteId })
      .onConflictDoNothing({ target: [reactions.reactableType, reactions.reactableId, reactions.userId, reactions.emoteId] })
      .returning({ id: reactions.id });
    if (inserted) after(() => notifyForumReaction({ message, actorId: userId, emoteName: emote.name, emoteImageUrl: emote.imagePath }));
  }

  const summary = await getReactionSummary(input.reactableType, input.reactableId, userId);
  return { ok: true, reactions: summary };
}

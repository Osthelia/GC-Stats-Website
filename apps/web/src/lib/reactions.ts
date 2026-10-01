/**
 * GC-Stats - reactions
 *
 * Emote reactions on polymorphic "reactable" content (forum messages for
 * now, more content types can join the same table later). Batched summary
 * queries so a list of reactables never triggers one query per row.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { adminDb } from "@gc-stats/db/client";
import { reactions, emotes } from "@gc-stats/db";
import { emoteImageUrl } from "@gc-stats/storage";

// Polymorphic like V1's `reactable_type`/`reactable_id` (see
// schema/content.ts), forum messages only for now, news/matches/tournaments
// are meant to grow into this same table later without a schema change.
export const REACTABLE_TYPES = ["forum_message"] as const;
export type ReactableType = (typeof REACTABLE_TYPES)[number];

export type ReactionSummary = {
  emoteId: number;
  emoteName: string;
  emoteImagePath: string;
  count: number;
  reactedByMe: boolean;
};

export type PickerEmote = { id: number; name: string; imagePath: string };

export async function getActiveEmotesForPicker(): Promise<PickerEmote[]> {
  const rows = await adminDb.select({ id: emotes.id, name: emotes.name, imagePath: emotes.imagePath }).from(emotes).where(eq(emotes.isActive, true)).orderBy(emotes.name);
  return rows.map((r) => ({ ...r, imagePath: emoteImageUrl(r.imagePath) }));
}

// adminDb (caching disabled): a just-toggled reaction must be visible in the summary returned by the same action call.
/** Batched summary for many reactables at once (same idea as forum-data.ts's attachThreadStats), never one query per row. */
export async function getReactionSummaries(reactableType: ReactableType, reactableIds: number[], userId: string | null): Promise<Map<number, ReactionSummary[]>> {
  if (reactableIds.length === 0) return new Map();

  const rows = await adminDb
    .select({
      reactableId: reactions.reactableId,
      emoteId: reactions.emoteId,
      emoteName: emotes.name,
      emoteImagePath: emotes.imagePath,
      userId: reactions.userId,
    })
    .from(reactions)
    .innerJoin(emotes, eq(emotes.id, reactions.emoteId))
    .where(and(eq(reactions.reactableType, reactableType), inArray(reactions.reactableId, reactableIds)));

  const byReactable = new Map<number, Map<number, ReactionSummary>>();
  for (const row of rows) {
    let byEmote = byReactable.get(row.reactableId);
    if (!byEmote) {
      byEmote = new Map();
      byReactable.set(row.reactableId, byEmote);
    }
    let summary = byEmote.get(row.emoteId);
    if (!summary) {
      summary = { emoteId: row.emoteId, emoteName: row.emoteName, emoteImagePath: emoteImageUrl(row.emoteImagePath), count: 0, reactedByMe: false };
      byEmote.set(row.emoteId, summary);
    }
    summary.count += 1;
    if (userId && row.userId === userId) summary.reactedByMe = true;
  }

  const result = new Map<number, ReactionSummary[]>();
  for (const [reactableId, byEmote] of byReactable) {
    result.set(
      reactableId,
      [...byEmote.values()].sort((a, b) => b.count - a.count)
    );
  }
  return result;
}

export async function getReactionSummary(reactableType: ReactableType, reactableId: number, userId: string | null): Promise<ReactionSummary[]> {
  const map = await getReactionSummaries(reactableType, [reactableId], userId);
  return map.get(reactableId) ?? [];
}

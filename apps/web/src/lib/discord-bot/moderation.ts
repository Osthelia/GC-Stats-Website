/**
 * GC-Stats - moderation
 *
 * Moderation of the Discord bot: blacklist of servers and Discord accounts,
 * and the review queue of the alert image templates servers edit.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { discordBotBlacklist, discordBotImageReviews } from "@gc-stats/db";
import { getLinkedDiscordId } from "@/lib/discord-guild-membership";
import { presetOfTemplate, type AlertTemplate } from "./template";
import type { DiscordBotEvent } from "./shared";

export type BlacklistKind = "guild" | "user";

export async function isBlacklisted(kind: BlacklistKind, discordId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: discordBotBlacklist.id })
    .from(discordBotBlacklist)
    .where(and(eq(discordBotBlacklist.kind, kind), eq(discordBotBlacklist.discordId, discordId)))
    .limit(1);
  return !!row;
}

/** Ids among `guildIds` that are blacklisted. */
export async function listBlacklistedGuildIds(guildIds: string[]): Promise<Set<string>> {
  if (guildIds.length === 0) return new Set();
  const rows = await db
    .select({ discordId: discordBotBlacklist.discordId })
    .from(discordBotBlacklist)
    .where(and(eq(discordBotBlacklist.kind, "guild"), inArray(discordBotBlacklist.discordId, guildIds)));
  return new Set(rows.map((r) => r.discordId));
}

/** True when the site account's linked Discord account is blacklisted. */
export async function isUserBlacklisted(userId: string): Promise<boolean> {
  const discordId = await getLinkedDiscordId(userId);
  return discordId ? isBlacklisted("user", discordId) : false;
}

const KIND_BY_EVENT = { match_live: "live", match_finished: "finished", map_finished: "map" } as const;

/**
 * Puts the template of a server back in the review queue after an edit. A template that is
 * still an untouched preset has nothing of the server's own to check.
 */
export async function queueTemplateReview(input: { guildId: string; event: DiscordBotEvent; userId: string; template: AlertTemplate }): Promise<void> {
  const untouched = !input.template.backgroundImageId && presetOfTemplate(input.template, KIND_BY_EVENT[input.event]) !== null;
  if (untouched) {
    await dropTemplateReview(input.guildId, input.event);
    return;
  }
  const editorDiscordId = await getLinkedDiscordId(input.userId);
  const now = new Date();
  await db
    .insert(discordBotImageReviews)
    .values({ guildId: input.guildId, event: input.event, editedBy: input.userId, editorDiscordId })
    .onConflictDoUpdate({
      target: [discordBotImageReviews.guildId, discordBotImageReviews.event],
      set: { editedBy: input.userId, editorDiscordId, status: "pending", reviewedBy: null, reviewedAt: null, updatedAt: now },
    });
}

/** Drops the review of a template that no longer exists. */
export async function dropTemplateReview(guildId: string, event: DiscordBotEvent): Promise<void> {
  await db.delete(discordBotImageReviews).where(and(eq(discordBotImageReviews.guildId, guildId), eq(discordBotImageReviews.event, event)));
}

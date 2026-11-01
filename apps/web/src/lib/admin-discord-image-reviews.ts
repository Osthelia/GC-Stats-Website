/**
 * GC-Stats - admin-discord-image-reviews
 *
 * Admin queries for the Discord bot page /admin/discord-images: the
 * alert image templates waiting for a check.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { discordBotBlacklist, discordBotImageDecisions, discordBotImageReviews, users } from "@gc-stats/db";
import type { DiscordBotEvent } from "@/lib/discord-bot/shared";

export const DISCORD_IMAGE_REVIEWS_PAGE_SIZE = 12;

export type AdminDiscordImageRow = {
  id: number;
  imageUrl: string;
  guildId: string;
  event: DiscordBotEvent;
  editorId: string | null;
  editorUsername: string | null;
  editorDiscordId: string | null;
  editedAt: string;
  guildBlacklisted: boolean;
  userBlacklisted: boolean;
};

export async function countPendingDiscordImages(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(discordBotImageReviews).where(eq(discordBotImageReviews.status, "pending"));
  return row?.count ?? 0;
}

/** Pending images, oldest first so nothing waits forever. */
export async function listPendingDiscordImages(page: number): Promise<{ rows: AdminDiscordImageRow[]; total: number }> {
  const pending = eq(discordBotImageReviews.status, "pending");
  const [reviews, countRows] = await Promise.all([
    db
      .select()
      .from(discordBotImageReviews)
      .where(pending)
      .orderBy(asc(discordBotImageReviews.updatedAt), asc(discordBotImageReviews.id))
      .limit(DISCORD_IMAGE_REVIEWS_PAGE_SIZE)
      .offset((page - 1) * DISCORD_IMAGE_REVIEWS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(discordBotImageReviews).where(pending),
  ]);

  const userIds = [...new Set(reviews.map((r) => r.editedBy).filter((v): v is string => !!v))];
  const discordIds = [...new Set(reviews.flatMap((r) => [r.guildId, r.editorDiscordId]).filter((v): v is string => !!v))];
  const [userRows, blacklistRows] = await Promise.all([
    userIds.length ? db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, userIds)) : [],
    discordIds.length ? db.select({ kind: discordBotBlacklist.kind, discordId: discordBotBlacklist.discordId }).from(discordBotBlacklist).where(inArray(discordBotBlacklist.discordId, discordIds)) : [],
  ]);
  const usernameOf = new Map(userRows.map((u) => [u.id, u.username] as const));
  const blocked = new Set(blacklistRows.map((b) => `${b.kind}:${b.discordId}`));

  return {
    rows: reviews.map((r) => ({
      id: r.id,
      // The edit date busts the cache once the template changes.
      imageUrl: `/api/admin/discord-images/${r.id}?v=${r.updatedAt.getTime()}`,
      guildId: r.guildId,
      event: r.event as DiscordBotEvent,
      editorId: r.editedBy,
      editorUsername: r.editedBy ? (usernameOf.get(r.editedBy) ?? null) : null,
      editorDiscordId: r.editorDiscordId,
      editedAt: r.updatedAt.toISOString(),
      guildBlacklisted: blocked.has(`guild:${r.guildId}`),
      userBlacklisted: r.editorDiscordId ? blocked.has(`user:${r.editorDiscordId}`) : false,
    })),
    total: countRows[0]?.count ?? 0,
  };
}

export const DISCORD_IMAGE_HISTORY_PAGE_SIZE = 20;

export type DiscordImageSanctionKind = "blacklist_guild" | "blacklist_user" | "reset_image" | "edit_messages";

export type AdminDiscordImageDecisionRow = {
  id: number;
  guildId: string;
  event: DiscordBotEvent;
  decision: "verified" | "sanctioned";
  sanctions: DiscordImageSanctionKind[];
  reason: string | null;
  editorId: string | null;
  editorUsername: string | null;
  editorDiscordId: string | null;
  moderatorId: string | null;
  moderatorUsername: string | null;
  decidedAt: string;
};

/** Decisions on alert images, newest first. */
export async function listDiscordImageDecisions(page: number): Promise<{ rows: AdminDiscordImageDecisionRow[]; total: number }> {
  const [decisions, countRows] = await Promise.all([
    db
      .select()
      .from(discordBotImageDecisions)
      .orderBy(desc(discordBotImageDecisions.decidedAt), desc(discordBotImageDecisions.id))
      .limit(DISCORD_IMAGE_HISTORY_PAGE_SIZE)
      .offset((page - 1) * DISCORD_IMAGE_HISTORY_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(discordBotImageDecisions),
  ]);

  const userIds = [...new Set(decisions.flatMap((d) => [d.editedBy, d.decidedBy]).filter((v): v is string => !!v))];
  const userRows = userIds.length ? await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, userIds)) : [];
  const usernameOf = new Map(userRows.map((u) => [u.id, u.username] as const));

  return {
    rows: decisions.map((d) => ({
      id: d.id,
      guildId: d.guildId,
      event: d.event as DiscordBotEvent,
      decision: d.decision as "verified" | "sanctioned",
      sanctions: d.sanctions as DiscordImageSanctionKind[],
      reason: d.reason,
      editorId: d.editedBy,
      editorUsername: d.editedBy ? (usernameOf.get(d.editedBy) ?? null) : null,
      editorDiscordId: d.editorDiscordId,
      moderatorId: d.decidedBy,
      moderatorUsername: d.decidedBy ? (usernameOf.get(d.decidedBy) ?? null) : null,
      decidedAt: d.decidedAt.toISOString(),
    })),
    total: countRows[0]?.count ?? 0,
  };
}

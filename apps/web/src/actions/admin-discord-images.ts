/**
 * GC-Stats - admin-discord-images
 *
 * Admin server actions reviewing the alert images of the Discord bot: verify
 * an image, or sanction it (blacklist the server, blacklist the Discord
 * account, reset the image).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { discordBotBlacklist, discordBotImageDecisions, discordBotImageReviews, discordBotMessages, discordBotSubscriptions, discordBotTemplates, PERMISSIONS } from "@gc-stats/db";
import { deleteDiscordBackground } from "@gc-stats/storage";
import { requireActorPermission } from "@/lib/rbac";
import { DISCORD_IMAGE_SANCTION_REASON_MAX, MESSAGE_IMAGE_REMOVED_HASH, MESSAGE_IMAGE_REMOVAL_QUEUED_HASH } from "@/lib/discord-bot/shared";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DiscordImageSanctionInput = { blacklistGuild: unknown; blacklistUser: unknown; resetImage: unknown; editMessages: unknown; reason: unknown };
export type DiscordImageSanctionFieldErrors = Partial<{
  sanctions: "required";
  blacklistUser: "noEditor";
  reason: "required" | "tooLong";
}>;

export type DiscordImageVerifyResult = { ok: true } | { ok: false; error: "notFound" };
/** `queued`: messages the bot will edit in the coming minutes. */
export type DiscordImageSanctionResult = { ok: true; queued: number } | { ok: false; error: "notFound" | "invalid"; fieldErrors?: DiscordImageSanctionFieldErrors };

export async function verifyDiscordImage(id: number): Promise<DiscordImageVerifyResult> {
  const access = await requireActorPermission(PERMISSIONS.moderationManage);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "notFound" };

  const [updated] = await db
    .update(discordBotImageReviews)
    .set({ status: "verified", reviewedBy: access.userId, reviewedAt: new Date() })
    .where(and(eq(discordBotImageReviews.id, id), eq(discordBotImageReviews.status, "pending")))
    .returning();
  if (!updated) return { ok: false, error: "notFound" };

  await db.insert(discordBotImageDecisions).values({
    guildId: updated.guildId,
    event: updated.event,
    decision: "verified",
    editedBy: updated.editedBy,
    editorDiscordId: updated.editorDiscordId,
    decidedBy: access.userId,
  });
  return { ok: true };
}

export async function sanctionDiscordImage(id: number, input: DiscordImageSanctionInput): Promise<DiscordImageSanctionResult> {
  const access = await requireActorPermission(PERMISSIONS.moderationManage);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "notFound" };

  const [review] = await db.select().from(discordBotImageReviews).where(and(eq(discordBotImageReviews.id, id), eq(discordBotImageReviews.status, "pending"))).limit(1);
  if (!review) return { ok: false, error: "notFound" };

  const fieldErrors: DiscordImageSanctionFieldErrors = {};
  const blacklistGuild = input?.blacklistGuild === true;
  const blacklistUser = input?.blacklistUser === true;
  const resetImage = input?.resetImage === true;
  const editMessages = input?.editMessages === true;
  if (!blacklistGuild && !blacklistUser && !resetImage && !editMessages) fieldErrors.sanctions = "required";
  if (blacklistUser && !review.editorDiscordId) fieldErrors.blacklistUser = "noEditor";

  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  if (!reason) fieldErrors.reason = "required";
  else if (reason.length > DISCORD_IMAGE_SANCTION_REASON_MAX) fieldErrors.reason = "tooLong";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "invalid", fieldErrors };

  // All or nothing, a failure halfway must not leave a blacklisted server with a review still pending.
  const { queued, removedBackgroundId } = await db.transaction(async (tx) => {
    const blacklist = async (kind: "guild" | "user", discordId: string) => {
      await tx.insert(discordBotBlacklist).values({ kind, discordId, reason, createdBy: access.userId }).onConflictDoNothing();
    };
    if (blacklistGuild) await blacklist("guild", review.guildId);
    if (blacklistUser && review.editorDiscordId) await blacklist("user", review.editorDiscordId);

    await tx.insert(discordBotImageDecisions).values({
      guildId: review.guildId,
      event: review.event,
      decision: "sanctioned",
      sanctions: [blacklistGuild && "blacklist_guild", blacklistUser && "blacklist_user", resetImage && "reset_image", editMessages && "edit_messages"].filter((v): v is string => !!v),
      reason,
      editedBy: review.editedBy,
      editorDiscordId: review.editorDiscordId,
      decidedBy: access.userId,
    });

    const queuedCount = editMessages ? await queueMessageEdits(tx, review.guildId, review.event) : 0;

    let backgroundId: string | null = null;
    if (resetImage) {
      backgroundId = await resetTemplate(tx, review.guildId, review.event);
      // A reset image is gone, nothing is left to review.
      await tx.delete(discordBotImageReviews).where(eq(discordBotImageReviews.id, review.id));
    } else {
      // Kept as is but sanctioned, it only comes back once edited.
      await tx.update(discordBotImageReviews).set({ status: "verified", reviewedBy: access.userId, reviewedAt: new Date() }).where(eq(discordBotImageReviews.id, review.id));
    }
    return { queued: queuedCount, removedBackgroundId: backgroundId };
  });
  // The file goes once the database change is committed.
  if (removedBackgroundId) await deleteDiscordBackground(removedBackgroundId).catch((error) => console.error("[discord-bot] background reset failed (%s)", removedBackgroundId, error));
  return { ok: true, queued };
}

/** Queues the messages already posted for this alert type, the bot job replaces their image with a notice. */
async function queueMessageEdits(tx: Tx, guildId: string, event: string): Promise<number> {
  const subscriptions = tx.select({ id: discordBotSubscriptions.id }).from(discordBotSubscriptions).where(and(eq(discordBotSubscriptions.guildId, guildId), eq(discordBotSubscriptions.event, event)));
  const queued = await tx
    .update(discordBotMessages)
    .set({ contentHash: MESSAGE_IMAGE_REMOVAL_QUEUED_HASH, updatedAt: new Date() })
    // A message already replaced or deleted on Discord has nothing left to edit.
    .where(and(inArray(discordBotMessages.subscriptionId, subscriptions), isNotNull(discordBotMessages.messageId), ne(discordBotMessages.contentHash, MESSAGE_IMAGE_REMOVED_HASH), ne(discordBotMessages.contentHash, "deleted")))
    .returning({ id: discordBotMessages.id });
  return queued.length;
}

/** Deletes the template of the server (back to the text embed), returns the id of its background file. */
async function resetTemplate(tx: Tx, guildId: string, event: string): Promise<string | null> {
  const [deleted] = await tx
    .delete(discordBotTemplates)
    .where(and(eq(discordBotTemplates.guildId, guildId), eq(discordBotTemplates.event, event)))
    .returning({ template: discordBotTemplates.template });
  return (deleted?.template as { backgroundImageId?: string | null } | undefined)?.backgroundImageId ?? null;
}

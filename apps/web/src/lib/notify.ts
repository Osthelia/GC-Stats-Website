/**
 * GC-Stats - notify
 *
 * Central notification dispatcher: creates the in-app notification row, then
 * fires opt-in email and Discord DM sends off the request's critical path.
 * Also owns read state, listing, and the debounced change request Discord
 * decision flush.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { after } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { adminDb } from "@gc-stats/db/client";
import { notifications, users, changeRequestDiscordNotices } from "@gc-stats/db";
import { sendEmail } from "@/lib/email/client";
import { renderNotificationEmail } from "@/lib/email/notification-template";
import { EMAIL_CATEGORIES, type EmailCategory, type NotificationType } from "@/lib/notification-categories";
import { getLinkedDiscordId, hasJoinedDiscordGuild } from "@/lib/discord-guild-membership";
import { sendDiscordNotification, type DiscordButton, type DiscordContainer, type DiscordEmbed } from "@/lib/discord-notifications-client";
import { buildSanctionEmbed, buildReportEmbed, buildChangeRequestDecisionContainer, buildForumContainer, isForumContainerType } from "@/lib/discord-notification-format";

export { EMAIL_CATEGORIES, type EmailCategory, type NotificationType };

const PAGE_SIZE = 20;
export const APP_BASE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const EMAIL_CATEGORY_BY_TYPE: Record<NotificationType, EmailCategory> = {
  "sanction.issued": "sanction",
  "change_request.comment": "change_request",
  "change_request.accepted": "change_request",
  "change_request.rejected": "change_request",
  "change_request.partial": "change_request",
  "change_request.withdrawn": "change_request",
  "report.resolved": "report",
  "discord.dm_blocked": "social",
  "forum.reply": "social",
  "forum.mention": "social",
  "forum.reaction": "social",
};

export type NotifyInput = {
  recipientId: string;
  type: NotificationType;
  authorId?: string | null;
  link?: string | null;
  data?: Record<string, unknown>;
};

export type NotificationRow = {
  id: number;
  type: string;
  data: Record<string, unknown>;
  link: string | null;
  authorId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/** Creates a notification row, then fires the opt-in email off the request's critical path. */
export async function notify(input: NotifyInput): Promise<void> {
  const [row] = await adminDb
    .insert(notifications)
    .values({
      userId: input.recipientId,
      authorId: input.authorId ?? null,
      type: input.type,
      data: input.data ?? {},
      link: input.link ?? null,
    })
    .returning({ id: notifications.id });
  if (!row) return;

  after(() => maybeSendEmail(input, row.id));
  after(() => maybeSendDiscordDM(input, row.id));
}

/**
 * Email/Discord always send the `/open` route, never the raw target link
 * directly: opening it marks the notification read before redirecting (see
 * app/[locale]/(site)/notifications/[id]/open/route.ts), so accessing the
 * site from the notification itself is what marks it read, not just
 * visiting the target page some other way. Locale "en" always, mirroring
 * emails always rendering in English (no stored per-user locale server side).
 */
function openLink(notificationId: number): string {
  return `${APP_BASE_URL}/en/notifications/${notificationId}/open`;
}

/**
 * Renders the notification's text at send time via next-intl rather than
 * storing translated strings — a moderator's locale must never leak into a
 * recipient's notification. Emails always render in English: there is no
 * stored per-user locale to pick from server-side (the in-app page/dropdown
 * render in the viewer's own locale as normal SSR).
 */
async function maybeSendEmail(input: NotifyInput, notificationId: number): Promise<void> {
  try {
    const [recipient] = await adminDb.select({ email: users.email, preferences: users.preferences }).from(users).where(eq(users.id, input.recipientId)).limit(1);
    if (!recipient?.email) return;

    const category = EMAIL_CATEGORY_BY_TYPE[input.type];
    const prefs = (recipient.preferences as { emailNotifications?: Partial<Record<EmailCategory, boolean>> } | null)?.emailNotifications;
    // Opt-in: a category with no explicit stored preference is off, never on by default.
    const enabled = prefs?.[category] ?? false;
    if (!enabled) return;

    const t = await getTranslations({ locale: "en", namespace: "notifications.type" });
    const title = t(`${input.type}.title` as never, input.data as never);
    const body = t(`${input.type}.body` as never, input.data as never);
    const link = openLink(notificationId);

    const { html, text } = renderNotificationEmail(title, body, link);
    await sendEmail({ to: recipient.email, subject: title, html, text });
  } catch (error) {
    console.warn("[notify] failed to send notification email", error);
  }
}

type DiscordSendPayload = { type: "message"; message: string; images?: string[]; button?: DiscordButton } | { type: "embed"; embed: DiscordEmbed; button?: DiscordButton } | { type: "container"; container: DiscordContainer };

/**
 * Same opt-in category preference as email, plus two hard gates: the
 * account must have a linked Discord account, and it must have joined
 * DISCORD_GUILD_ID (checked live — a DM fails otherwise, since the bot
 * needs a mutual server with the recipient).
 */
async function sendDiscordDmToRecipient(recipientId: string, category: EmailCategory, buildPayload: () => Promise<DiscordSendPayload | null>): Promise<void> {
  const [recipient] = await adminDb.select({ preferences: users.preferences }).from(users).where(eq(users.id, recipientId)).limit(1);
  if (!recipient) return;

  const prefs = (recipient.preferences as { discordNotifications?: Partial<Record<EmailCategory, boolean>> } | null)?.discordNotifications;
  const enabled = prefs?.[category] ?? false;
  if (!enabled) return;

  const discordId = await getLinkedDiscordId(recipientId);
  if (!discordId) return;
  if (!(await hasJoinedDiscordGuild(recipientId))) return;

  const payload = await buildPayload();
  if (!payload) return;

  const result = await sendDiscordNotification({ discordId, ...payload });
  if (!result.ok && result.error === "dm_blocked") await notifyDiscordDmBlockedOnce(recipientId);
}

/** Debounce window so several change request items resolved close together (bulk resolve, or two moderators racing the same request) coalesce into a single Discord message instead of one per item. */
const CHANGE_REQUEST_DISCORD_DEBOUNCE_MS = 2 * 60 * 1000;

/** Upserts the pending notice, pushing scheduledAt forward on every call — see flush-change-request-discord-notices.ts for the other half. */
async function scheduleChangeRequestDiscordNotice(changeRequestId: number): Promise<void> {
  const scheduledAt = new Date(Date.now() + CHANGE_REQUEST_DISCORD_DEBOUNCE_MS);
  await adminDb
    .insert(changeRequestDiscordNotices)
    .values({ changeRequestId, scheduledAt })
    .onConflictDoUpdate({ target: changeRequestDiscordNotices.changeRequestId, set: { scheduledAt } });
}

/** Builds the type-specific Discord payload — embed for sanctions/reports, plain text for a change request reply, ready-made container for a change request decision (see sendChangeRequestDiscordDecision). */
async function buildDiscordPayload(input: NotifyInput, notificationId: number): Promise<DiscordSendPayload | null> {
  const link = openLink(notificationId);
  const t = await getTranslations({ locale: "en" });
  const button: DiscordButton = { label: t("notifications.discordButton"), url: link };

  if (input.type === "sanction.issued") {
    const sanctionId = input.data?.sanctionId;
    if (typeof sanctionId !== "number") return null;
    const built = await buildSanctionEmbed(t, sanctionId);
    return built ? { type: "embed", embed: built.embed, button } : null;
  }

  if (input.type === "report.resolved") {
    const reportId = input.data?.reportId;
    const status = input.data?.status;
    if (typeof reportId !== "number" || (status !== "resolved" && status !== "dismissed")) return null;
    const built = await buildReportEmbed(t, reportId, status);
    return built ? { type: "embed", embed: built.embed, button } : null;
  }

  if (isForumContainerType(input.type)) {
    return { type: "container", container: buildForumContainer(t, input.type, input.data ?? {}, link, button.label) };
  }

  const title = t(`notifications.type.${input.type}.title` as never, input.data as never);
  const body = t(`notifications.type.${input.type}.body` as never, input.data as never);
  return { type: "message", message: `**${title}**\n${body}`, button };
}

/**
 * Sending this one over Discord would just hit the same dm_blocked error it
 * exists to report, and re-trigger itself below — in-app/email only. The
 * three change_request decision types are debounced instead of sent
 * immediately (see scheduleChangeRequestDiscordNotice above).
 */
async function maybeSendDiscordDM(input: NotifyInput, notificationId: number): Promise<void> {
  if (input.type === "discord.dm_blocked") return;

  try {
    if (input.type === "change_request.accepted" || input.type === "change_request.rejected" || input.type === "change_request.partial") {
      const changeRequestId = input.data?.changeRequestId;
      if (typeof changeRequestId === "number") await scheduleChangeRequestDiscordNotice(changeRequestId);
      return;
    }

    await sendDiscordDmToRecipient(input.recipientId, EMAIL_CATEGORY_BY_TYPE[input.type], () => buildDiscordPayload(input, notificationId));
  } catch (error) {
    console.warn("[notify] failed to send Discord DM", error);
  }
}

/** The flush side of the change request Discord debounce — rebuilds the container from the current DB state (every item's latest status), never from whichever resolution last fired. Called by the per-minute scheduled job. */
export async function sendChangeRequestDiscordDecision(changeRequestId: number): Promise<boolean> {
  try {
    const t = await getTranslations({ locale: "en" });
    const link = `${APP_BASE_URL}/settings/change-requests/${changeRequestId}`;
    const decision = await buildChangeRequestDecisionContainer(t, changeRequestId, link, t("notifications.discordButton"));
    if (!decision) return false;

    await sendDiscordDmToRecipient(decision.recipientId, "change_request", async () => ({ type: "container", container: decision.container }));
    return true;
  } catch (error) {
    console.warn("[notify] failed to send change request Discord decision", error);
    return false;
  }
}

/** One unread "your DMs are closed" notice at a time — a batch of failed DMs shouldn't spam the bell. */
async function notifyDiscordDmBlockedOnce(recipientId: string): Promise<void> {
  const [existing] = await adminDb
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, recipientId), eq(notifications.type, "discord.dm_blocked"), isNull(notifications.readAt)))
    .limit(1);
  if (existing) return;

  await notify({ recipientId, type: "discord.dm_blocked", link: "/settings/account" });
}

// Bell indicator reads/writes go through adminDb (caching disabled) so a mark-as-read
// or a freshly created notification is never masked by Hyperdrive's stale cache.
export async function markRead(notificationId: number, userId: string): Promise<boolean> {
  const rows = await adminDb
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await adminDb.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/**
 * The debounced change request Discord container (see scheduleChangeRequestDiscordNotice)
 * coalesces several notify() calls into one message with a single button linking straight
 * to `/settings/change-requests/{id}`, not through `/open` — there is no single notification
 * row to mark read on click. Called from that page instead, marking every matching row read
 * once the recipient actually opens it (ownership already checked by the caller).
 */
export async function markChangeRequestNotificationsRead(userId: string, changeRequestId: number): Promise<void> {
  await adminDb
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        sql`${notifications.type} in ('change_request.accepted', 'change_request.rejected', 'change_request.partial', 'change_request.comment')`,
        sql`(${notifications.data}->>'changeRequestId')::int = ${changeRequestId}`,
      ),
    );
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await adminDb
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

export async function listNotifications(userId: string, { page, unreadOnly }: { page: number; unreadOnly: boolean }): Promise<{ rows: NotificationRow[]; totalPages: number }> {
  const where = unreadOnly ? and(eq(notifications.userId, userId), isNull(notifications.readAt)) : eq(notifications.userId, userId);

  const [rows, countRows] = await Promise.all([
    adminDb
      .select({ id: notifications.id, type: notifications.type, data: notifications.data, link: notifications.link, authorId: notifications.authorId, readAt: notifications.readAt, createdAt: notifications.createdAt })
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(notifications).where(where),
  ]);

  return { rows: rows as NotificationRow[], totalPages: Math.max(1, Math.ceil((countRows[0]?.count ?? 0) / PAGE_SIZE)) };
}

export async function listRecentNotifications(userId: string, limit: number): Promise<NotificationRow[]> {
  const rows = await adminDb
    .select({ id: notifications.id, type: notifications.type, data: notifications.data, link: notifications.link, authorId: notifications.authorId, readAt: notifications.readAt, createdAt: notifications.createdAt })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows as NotificationRow[];
}

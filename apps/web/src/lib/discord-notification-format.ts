/**
 * GC-Stats - discord-notification-format
 *
 * Builds the Discord message containers/embeds for moderation and change
 * request notifications (sanctions, reports, approvals), always attributed
 * to GC Stats.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import type { getTranslations } from "next-intl/server";
import { db } from "@gc-stats/db/client";
import { sanctions, userReports, changeRequests, changeRequestItems, teams, people } from "@gc-stats/db";
import { SANCTION_COLORS, type SanctionType } from "@/lib/sanction-constants";
import type { DiscordContainer, DiscordContainerBlock, DiscordEmbed, DiscordEmbedField } from "@/lib/discord-notifications-client";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const REPORT_STATUS_COLORS: Record<"resolved" | "dismissed", number> = {
  resolved: 0x57f287,
  dismissed: 0x99aab5,
};

const CHANGE_REQUEST_STATUS_COLORS: Record<"approved" | "rejected" | "partial", number> = {
  approved: 0x57f287,
  rejected: 0xed4245,
  partial: 0xe67e22,
};

const MAX_CONTAINER_TEXT_LENGTH = 3500;

/** Every field/object shown in a Discord notification is attributed to GC Stats — never a bare, unbranded message. */
const ATTRIBUTION = "GC Stats";

function tHas(t: Translator, key: string): boolean {
  return t.has(key as never);
}

function translate(t: Translator, key: string, values?: Record<string, unknown>): string {
  return t(key as never, values as never);
}

/** Builds the sanction.issued embed, reading the sanction's reason/dates fresh (notify() only stores the type in its own data payload). */
export async function buildSanctionEmbed(t: Translator, sanctionId: number): Promise<{ embed: DiscordEmbed } | null> {
  const [row] = await db.select({ type: sanctions.type, reason: sanctions.reason, startsAt: sanctions.startsAt, endsAt: sanctions.endsAt }).from(sanctions).where(eq(sanctions.id, sanctionId)).limit(1);
  if (!row) return null;

  const type = row.type as SanctionType;
  const fields: DiscordEmbedField[] = [{ name: translate(t, "admin.sanctions.fieldReason"), value: row.reason.slice(0, 1024) }];
  if (row.endsAt) {
    fields.push({ name: translate(t, "admin.sanctions.columnEndsAt"), value: row.endsAt.toISOString().slice(0, 10), inline: true });
  }

  return {
    embed: {
      title: translate(t, "notifications.type.sanction.issued.title"),
      description: translate(t, "notifications.type.sanction.issued.body", { sanctionType: translate(t, `admin.sanctions.type.${type}`) }),
      color: SANCTION_COLORS[type],
      authorName: ATTRIBUTION,
      timestamp: row.startsAt.toISOString(),
      fields,
    },
  };
}

/** Builds the report.resolved embed, reading the report's category/reason/resolution note fresh. */
export async function buildReportEmbed(t: Translator, reportId: number, status: "resolved" | "dismissed"): Promise<{ embed: DiscordEmbed } | null> {
  const [row] = await db
    .select({ category: userReports.category, reason: userReports.reason, resolutionNote: userReports.resolutionNote })
    .from(userReports)
    .where(eq(userReports.id, reportId))
    .limit(1);
  if (!row) return null;

  const fields: DiscordEmbedField[] = [
    { name: translate(t, "forum.report.categoryLabel"), value: tHas(t, `forum.report.category.${row.category}`) ? translate(t, `forum.report.category.${row.category}`) : row.category, inline: true },
    { name: translate(t, "forum.report.reasonLabel"), value: row.reason.slice(0, 1024) },
  ];
  if (row.resolutionNote) fields.push({ name: translate(t, "admin.reports.noteLabel"), value: row.resolutionNote.slice(0, 1024) });

  return {
    embed: {
      title: translate(t, "notifications.type.report.resolved.title"),
      description: translate(t, "notifications.type.report.resolved.body", { status: translate(t, `admin.reports.status.${status}`) }),
      color: REPORT_STATUS_COLORS[status],
      authorName: ATTRIBUTION,
      fields,
    },
  };
}

function fieldLabel(field: string, t: Translator): string {
  if (field.startsWith("socials.")) return translate(t, `suggestEdit.field.${field.slice("socials.".length)}`);
  if (tHas(t, `admin.changeRequests.detail.field.${field}`)) return translate(t, `admin.changeRequests.detail.field.${field}`);
  if (tHas(t, `suggestEdit.field.${field}`)) return translate(t, `suggestEdit.field.${field}`);
  return field;
}

/** Best-effort human rendering of an item's old/new value — full fidelity with the admin panel's rich renderer isn't worth reproducing here. */
function formatFieldValue(value: unknown, t: Translator): string {
  if (value === null || value === undefined) return translate(t, "admin.changeRequests.detail.noValue");
  if (typeof value === "boolean") return translate(t, value ? "admin.changeRequests.detail.yes" : "admin.changeRequests.detail.no");
  if (typeof value === "string") return value.trim().length > 0 ? value : translate(t, "admin.changeRequests.detail.noValue");
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length > 0 ? value.map(String).join(", ") : translate(t, "admin.changeRequests.detail.noValue");
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return translate(t, "admin.changeRequests.detail.noValue");
    return entries
      .map(([key, v]) => {
        if (key === "role" && typeof v === "string") return tHas(t, `suggestEdit.roster.roleOption.${v}`) ? translate(t, `suggestEdit.roster.roleOption.${v}`) : v;
        return String(v);
      })
      .join(", ");
  }
  return String(value);
}

const ITEM_STATUS_ICON: Record<string, string> = { approved: "✅", rejected: "❌", failed: "⚠️" };
const ITEM_STATUS_KEY: Record<string, string> = {
  approved: "admin.changeRequests.detail.itemStatusApproved",
  rejected: "admin.changeRequests.detail.itemStatusRejected",
  failed: "admin.changeRequests.detail.itemStatusFailed",
};

function itemLine(item: { field: string; oldValue: unknown; newValue: unknown; status: string; resolutionNote: string | null }, t: Translator): string {
  const label = fieldLabel(item.field, t);
  const oldText = formatFieldValue(item.oldValue, t);
  const newText = formatFieldValue(item.newValue, t);
  const icon = ITEM_STATUS_ICON[item.status] ?? "•";
  const statusKey = ITEM_STATUS_KEY[item.status];
  const statusLabel = statusKey ? translate(t, statusKey) : item.status;

  let line = `**${label}**\n${translate(t, "admin.changeRequests.detail.oldValue")}: ${oldText} → ${translate(t, "admin.changeRequests.detail.newValue")}: ${newText}\n${icon} ${statusLabel}`;
  if (item.resolutionNote) line += `\n> ${item.resolutionNote}`;
  return line;
}

/** Packs item lines into as few text blocks as possible, each under the Worker's per-block character limit. */
function chunkItemLines(lines: string[]): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const candidate = current ? `${current}\n\n${line}` : line;
    if (candidate.length > MAX_CONTAINER_TEXT_LENGTH && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const FORUM_CONTAINER_TYPES = ["forum.reply", "forum.mention", "forum.reaction"] as const;
type ForumContainerType = (typeof FORUM_CONTAINER_TYPES)[number];

export function isForumContainerType(type: string): type is ForumContainerType {
  return (FORUM_CONTAINER_TYPES as readonly string[]).includes(type);
}

/**
 * Builds the reply/mention/reaction container straight from the snapshot
 * taken at notify() time (`sourceExcerpt`/`replyExcerpt`/`emoteName`/`emoteImageUrl`
 * in `notify.ts`'s data payload) — no DB read here, so it still renders the
 * message as it was when the notification fired even if since edited/deleted.
 */
export function buildForumContainer(t: Translator, type: ForumContainerType, data: Record<string, unknown>, link: string, buttonLabel: string): DiscordContainer {
  const title = translate(t, `notifications.type.${type}.title`);
  const blocks: DiscordContainerBlock[] = [{ kind: "text", content: `**${ATTRIBUTION}**\n${title}` }, { kind: "separator", divider: true }];

  const sourceExcerpt = typeof data.sourceExcerpt === "string" ? data.sourceExcerpt : null;
  if (sourceExcerpt) {
    const quoted = sourceExcerpt.split("\n").map((line) => `> ${line}`).join("\n");
    blocks.push({ kind: "text", content: `**${translate(t, "notifications.discordSourceLabel")}**\n${quoted}` });
  }

  if (type === "forum.reaction") {
    const emoteName = typeof data.emoteName === "string" ? data.emoteName : null;
    blocks.push({ kind: "text", content: `**${translate(t, "notifications.discordReactionLabel")}**\n${emoteName ? `:${emoteName}:` : "?"}` });
    const emoteImageUrl = typeof data.emoteImageUrl === "string" ? data.emoteImageUrl : null;
    if (emoteImageUrl) blocks.push({ kind: "images", urls: [emoteImageUrl] });
  } else {
    const replyExcerpt = typeof data.replyExcerpt === "string" ? data.replyExcerpt : null;
    if (replyExcerpt) blocks.push({ kind: "text", content: `**${translate(t, "notifications.discordReplyLabel")}**\n${replyExcerpt}` });
  }

  blocks.push({ kind: "separator", divider: true }, { kind: "buttons", buttons: [{ label: buttonLabel, url: link }] });
  return { blocks };
}

export type ChangeRequestDecision = { recipientId: string; container: DiscordContainer } | null;

/**
 * Builds the change request decision container from the current DB state
 * (never from the event that triggered it) — the debounce in notify.ts may
 * coalesce several item resolutions, so this always reflects every item's
 * latest status, not just the one that last fired.
 */
export async function buildChangeRequestDecisionContainer(t: Translator, changeRequestId: number, link: string, viewButtonLabel: string): Promise<ChangeRequestDecision> {
  const [request] = await db
    .select({ subjectType: changeRequests.subjectType, subjectId: changeRequests.subjectId, requestedBy: changeRequests.requestedBy, status: changeRequests.status })
    .from(changeRequests)
    .where(eq(changeRequests.id, changeRequestId))
    .limit(1);
  if (!request?.requestedBy || request.status === "pending") return null;
  const status = request.status as "approved" | "rejected" | "partial";

  const items = await db
    .select({ field: changeRequestItems.field, oldValue: changeRequestItems.oldValue, newValue: changeRequestItems.newValue, status: changeRequestItems.status, resolutionNote: changeRequestItems.resolutionNote })
    .from(changeRequestItems)
    .where(eq(changeRequestItems.changeRequestId, changeRequestId));
  if (items.length === 0) return null;

  let subjectName: string;
  if (request.subjectType === "team") {
    const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, request.subjectId)).limit(1);
    subjectName = team ? `${translate(t, "admin.changeRequests.subjectTeam")} · ${team.name}` : translate(t, "admin.changeRequests.unknownSubject", { id: request.subjectId });
  } else {
    const [person] = await db.select({ handle: people.handle }).from(people).where(eq(people.id, request.subjectId)).limit(1);
    subjectName = person ? `${translate(t, "admin.changeRequests.subjectPerson")} · ${person.handle}` : translate(t, "admin.changeRequests.unknownSubject", { id: request.subjectId });
  }

  const header = `**${ATTRIBUTION}**\n${translate(t, `notifications.type.change_request.${status}.title`)}\n${subjectName}`;

  const blocks: DiscordContainerBlock[] = [{ kind: "text", content: header }, { kind: "separator", divider: true }];
  for (const chunk of chunkItemLines(items.map((item) => itemLine(item, t)))) {
    blocks.push({ kind: "text", content: chunk });
  }
  blocks.push({ kind: "separator", divider: true }, { kind: "buttons", buttons: [{ label: viewButtonLabel, url: link }] });

  return { recipientId: request.requestedBy, container: { accentColor: CHANGE_REQUEST_STATUS_COLORS[status], blocks } };
}

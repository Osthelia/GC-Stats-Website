/**
 * GC-Stats - dispatch
 *
 * Scheduled job of the Discord bot: compares the state of live and recently
 * finished matches with the messages already posted, then posts or edits what
 * the active subscriptions are missing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { discordBotMessages, discordBotSubscriptions } from "@gc-stats/db";
import { editChannelMessage, postChannelMessage } from "./api";
import { buildAlertMessage, composeRemovedImageMessage } from "./message";
import { resolveImageRemovedNotice, resolveMatchButtonLabel, type AlertColors, type AlertKind } from "./render";
import { loadMatchContexts, type MatchContext } from "./match-data";
import { listBlacklistedGuildIds } from "./moderation";
import { listTemplates, type StoredTemplate } from "./templates";
import { listGuildSettings, resolveBotToken, type GuildSettings } from "./settings";
import { DISCORD_BOT_DEFAULT_BACKGROUND, DISCORD_BOT_DEFAULT_COLORS, GCS_SITE_URL, MESSAGE_IMAGE_REMOVED_HASH, MESSAGE_IMAGE_REMOVAL_QUEUED_HASH, type DiscordBotEvent } from "./shared";

const MAX_SENDS_PER_RUN = 100;
// A claim without message id older than this belongs to a run that never finished.
const STALE_CLAIM_MS = 5 * 60 * 1000;
// Content hash of a live message that was deleted on Discord.
const DELETED_HASH = "deleted";

type Subscription = typeof discordBotSubscriptions.$inferSelect;
type Outcome = "posted" | "edited" | "failed";
// Bot token and embed colors a subscription posts with.
type Theme = { token: string | null; colors: AlertColors; template: StoredTemplate | null; matchButton: boolean };

const KIND_BY_EVENT: Record<DiscordBotEvent, AlertKind> = { match_live: "live", match_finished: "finished", map_finished: "map" };

function matchesFilters(sub: Subscription, ctx: MatchContext): boolean {
  if (sub.filterRegions.length > 0 && (!ctx.region || !sub.filterRegions.includes(ctx.region))) return false;
  if (sub.filterOfficial === "official" && !ctx.official) return false;
  if (sub.filterOfficial === "unofficial" && ctx.official) return false;
  if (sub.filterTeamIds.length > 0 && !ctx.teamIds.some((id) => sub.filterTeamIds.includes(id))) return false;
  return true;
}

function resolveTheme(sub: Subscription, settings: GuildSettings | undefined, templates: Map<DiscordBotEvent, StoredTemplate> | undefined): Theme {
  const own = sub.color;
  return {
    token: resolveBotToken(settings),
    matchButton: settings?.matchButton ?? true,
    template: templates?.get(sub.event as DiscordBotEvent) ?? null,
    colors: {
      live: own ?? settings?.colorLive ?? DISCORD_BOT_DEFAULT_COLORS.live,
      finished: own ?? settings?.colorFinished ?? DISCORD_BOT_DEFAULT_COLORS.finished,
      map: own ?? settings?.colorMap ?? DISCORD_BOT_DEFAULT_COLORS.map,
      background: settings?.colorBackground ?? DISCORD_BOT_DEFAULT_BACKGROUND,
    },
  };
}

async function disableSubscription(id: number, reason: string): Promise<void> {
  await db.update(discordBotSubscriptions).set({ isActive: false, disabledReason: reason, updatedAt: new Date() }).where(eq(discordBotSubscriptions.id, id));
}

/** Posts the alert once (claimed first so overlapping runs cannot double post), or edits the live one when its content changed. */
async function deliver(sub: Subscription, theme: Theme, ctx: MatchContext, kind: AlertKind, messageKind: string, mapId: number | null, budget: { left: number }): Promise<Outcome | null> {
  const { match } = ctx;
  const map = mapId !== null ? match.maps.find((m) => m.id === mapId) : undefined;
  const contentHash = crypto
    .createHash("sha1")
    .update(JSON.stringify([theme.colors, theme.matchButton, theme.template?.updatedAt ?? null, match.status, match.nameA, match.nameB, match.scoreA, match.scoreB, match.maps.map((m) => [m.id, m.scoreA, m.scoreB, m.isCompleted, m.mvp?.handle ?? null]), match.vetos.length, sub.locale]))
    .digest("hex");

  const [existing] = await db
    .select()
    .from(discordBotMessages)
    .where(and(eq(discordBotMessages.subscriptionId, sub.id), eq(discordBotMessages.matchId, match.id), eq(discordBotMessages.kind, messageKind)));

  if (existing && !existing.messageId && Date.now() - existing.updatedAt.getTime() > STALE_CLAIM_MS) {
    // The run that claimed it died before posting, release it so the alert is retried.
    await db.delete(discordBotMessages).where(eq(discordBotMessages.id, existing.id));
    return null;
  }

  if (existing) {
    // Only the live message follows the match, the others are final once posted.
    if (kind !== "live" || existing.contentHash === contentHash || existing.contentHash === DELETED_HASH || existing.contentHash === MESSAGE_IMAGE_REMOVED_HASH || existing.contentHash === MESSAGE_IMAGE_REMOVAL_QUEUED_HASH || !existing.messageId || budget.left <= 0) return null;
    budget.left--;
    const message = await buildAlertMessage(kind, match, sub.locale, map, theme.colors, theme.template?.template ?? null, theme.matchButton);
    const result = await editChannelMessage(theme.token, sub.channelId, existing.messageId, message.components, message.attachment);
    if (result.ok) {
      await db.update(discordBotMessages).set({ contentHash, updatedAt: new Date() }).where(eq(discordBotMessages.id, existing.id));
      return "edited";
    }
    if (result.gone) {
      // The message was deleted, the live alert is neither edited nor posted again.
      await db.update(discordBotMessages).set({ contentHash: DELETED_HASH, updatedAt: new Date() }).where(eq(discordBotMessages.id, existing.id));
      return "failed";
    }
    if (result.permanent) await disableSubscription(sub.id, result.error);
    return "failed";
  }

  // A finished match was never live for this subscription, there is nothing to announce as live.
  if ((kind === "live" && match.status !== "live") || budget.left <= 0) return null;
  budget.left--;
  const [claim] = await db
    .insert(discordBotMessages)
    .values({ subscriptionId: sub.id, matchId: match.id, kind: messageKind, contentHash })
    .onConflictDoNothing()
    .returning({ id: discordBotMessages.id });
  if (!claim) return null;

  const message = await buildAlertMessage(kind, match, sub.locale, map, theme.colors, theme.template?.template ?? null, theme.matchButton);
  const result = await postChannelMessage(theme.token, sub.channelId, message.components, message.attachment);
  if (result.ok) {
    await db.update(discordBotMessages).set({ messageId: result.messageId, updatedAt: new Date() }).where(eq(discordBotMessages.id, claim.id));
    return "posted";
  }
  // Release the claim so a transient failure is retried on the next run.
  await db.delete(discordBotMessages).where(eq(discordBotMessages.id, claim.id));
  if (result.permanent) await disableSubscription(sub.id, result.error);
  return "failed";
}

/** Replaces the alerts moderation removed the image of with a notice, as many as the budget allows per run. */
async function replaceModeratedImages(budget: { left: number }): Promise<number> {
  const queued = await db
    .select({ id: discordBotMessages.id, messageId: discordBotMessages.messageId, matchId: discordBotMessages.matchId, channelId: discordBotSubscriptions.channelId, guildId: discordBotSubscriptions.guildId, locale: discordBotSubscriptions.locale, event: discordBotSubscriptions.event, color: discordBotSubscriptions.color })
    .from(discordBotMessages)
    .innerJoin(discordBotSubscriptions, eq(discordBotSubscriptions.id, discordBotMessages.subscriptionId))
    .where(eq(discordBotMessages.contentHash, MESSAGE_IMAGE_REMOVAL_QUEUED_HASH))
    .limit(budget.left);
  if (queued.length === 0) return 0;

  const settings = await listGuildSettings([...new Set(queued.map((m) => m.guildId))]);
  let replaced = 0;
  for (const message of queued) {
    if (!message.messageId) continue;
    const guildSettings = settings.get(message.guildId);
    const kind = KIND_BY_EVENT[message.event as DiscordBotEvent];
    const accent = message.color ?? (kind === "live" ? guildSettings?.colorLive : kind === "map" ? guildSettings?.colorMap : guildSettings?.colorFinished) ?? DISCORD_BOT_DEFAULT_COLORS[kind ?? "finished"];
    const url = `${GCS_SITE_URL}/${message.locale}/match/${message.matchId}`;
    const replacement = composeRemovedImageMessage({
      notice: await resolveImageRemovedNotice(message.locale),
      accent,
      url,
      buttonLabel: guildSettings?.matchButton === false ? null : await resolveMatchButtonLabel(message.locale),
    });
    budget.left--;
    const result = await editChannelMessage(resolveBotToken(guildSettings), message.channelId, message.messageId, replacement.components, undefined, true);
    // A message that is gone or out of reach will not get better by retrying, only transient failures wait for the next run.
    if (result.ok || result.permanent) {
      await db.update(discordBotMessages).set({ contentHash: MESSAGE_IMAGE_REMOVED_HASH, updatedAt: new Date() }).where(eq(discordBotMessages.id, message.id));
      if (result.ok) replaced++;
    }
  }
  return replaced;
}

/** Scheduled job entry point. */
export async function dispatchDiscordBot(): Promise<string> {
  const budget = { left: MAX_SENDS_PER_RUN };
  const replaced = await replaceModeratedImages(budget);

  const activeSubs = await db.select().from(discordBotSubscriptions).where(eq(discordBotSubscriptions.isActive, true));
  const blacklisted = await listBlacklistedGuildIds([...new Set(activeSubs.map((s) => s.guildId))]);
  const allSubs = activeSubs.filter((s) => !blacklisted.has(s.guildId));
  if (allSubs.length === 0) return replaced > 0 ? `replaced ${replaced} moderated discord image(s)` : "no discord alert subscription";
  const contexts = await loadMatchContexts();
  if (contexts.length === 0) return "no discord alert to send";
  const settings = await listGuildSettings([...new Set(allSubs.map((s) => s.guildId))]);
  const templates = await listTemplates([...new Set(allSubs.map((s) => s.guildId))]);
  const themes = new Map(allSubs.map((s) => [s.id, resolveTheme(s, settings.get(s.guildId), templates.get(s.guildId))]));
  // A server without any usable bot token has nothing to post with.
  const subs = allSubs.filter((s) => themes.get(s.id)?.token);
  if (subs.length === 0) return "no discord bot token configured";

  const counts: Record<Outcome, number> = { posted: 0, edited: 0, failed: 0 };
  const disabled = new Set<number>();

  for (const ctx of contexts) {
    for (const sub of subs) {
      if (disabled.has(sub.id) || !matchesFilters(sub, ctx)) continue;
      const kind = KIND_BY_EVENT[sub.event as DiscordBotEvent];
      if (!kind) continue;

      const tasks: { messageKind: string; mapId: number | null }[] = [];
      if (kind === "live") tasks.push({ messageKind: "live", mapId: null });
      else if (kind === "finished") {
        if (ctx.match.status === "completed") tasks.push({ messageKind: "finished", mapId: null });
      } else {
        for (const m of ctx.match.maps.filter((x) => x.isCompleted)) tasks.push({ messageKind: `map:${m.id}`, mapId: m.id });
      }

      for (const task of tasks) {
        let outcome: Outcome | null;
        try {
          outcome = await deliver(sub, themes.get(sub.id) as Theme, ctx, kind, task.messageKind, task.mapId, budget);
        } catch (error) {
          console.error("[discord-bot] alert delivery failed (subscription #%d, match #%d)", sub.id, ctx.match.id, error);
          counts.failed++;
          continue;
        }
        if (!outcome) continue;
        counts[outcome]++;
        // A lost channel was just switched off, its remaining alerts would fail the same way.
        if (outcome === "failed") {
          const [fresh] = await db.select({ isActive: discordBotSubscriptions.isActive }).from(discordBotSubscriptions).where(eq(discordBotSubscriptions.id, sub.id));
          if (fresh && !fresh.isActive) {
            disabled.add(sub.id);
            break;
          }
        }
      }
    }
  }
  return `sent ${counts.posted}/${counts.posted + counts.failed} discord alert(s), edited ${counts.edited}, replaced ${replaced} moderated image(s)`;
}

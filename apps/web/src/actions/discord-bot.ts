/**
 * GC-Stats - discord-bot
 *
 * Dashboard server actions managing the alert subscriptions of the Discord
 * bot. Every action re-checks, against the actor's own Discord account, that
 * they may manage the server.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { discordBotGuildSettings, discordBotSubscriptions, discordBotTemplates, teams } from "@gc-stats/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteDiscordBackground, storeDiscordBackground, validateImageBuffer } from "@gc-stats/storage";
import { encrypt } from "@/lib/encryption";
import { fetchBotIdentity, postChannelMessage } from "@/lib/discord-bot/api";
import { renderTemplateImage } from "@/lib/discord-bot/image";
import { composeAlertMessage } from "@/lib/discord-bot/message";
import { resolveMatchButtonLabel } from "@/lib/discord-bot/render";
import { resolvePreviewData } from "@/lib/discord-bot/preview";
import { getGuildSettings, resolveBotToken } from "@/lib/discord-bot/settings";
import { getGuildTemplates } from "@/lib/discord-bot/templates";
import { pinExternalImages } from "@/lib/discord-bot/pins";
import { createDefaultTemplate, presetsOf, templateSchema, type AlertTemplate, type TemplatePreset } from "@/lib/discord-bot/template";
import { getCurrentUserId } from "@/lib/session";
import { routing } from "@/i18n/routing";
import { listWebhookRegions } from "@/lib/webhooks/endpoints";
import { getManageableGuild, listGuildTextChannels } from "@/lib/discord-bot/guilds";
import { dropTemplateReview, isBlacklisted, isUserBlacklisted, queueTemplateReview } from "@/lib/discord-bot/moderation";
import {
  DISCORD_BOT_COLOR_PATTERN,
  DISCORD_BOT_DEFAULT_BACKGROUND,
  DISCORD_BOT_DEFAULT_COLORS,
  DISCORD_BOT_EVENTS,
  DISCORD_BOT_LIMITS,
  GCS_SITE_URL,
  DISCORD_BOT_OFFICIAL_FILTERS,
  type DiscordBotEvent,
  type DiscordBotOfficialFilter,
} from "@/lib/discord-bot/shared";

export type DiscordSubscriptionInput = {
  channelId: unknown;
  event: unknown;
  locale: unknown;
  filterRegions: unknown;
  filterTeamIds: unknown;
  filterOfficial: unknown;
  color: unknown;
};

export type DiscordSubscriptionFieldErrors = Partial<{
  channelId: "required" | "unknownChannel";
  event: "invalid";
  locale: "invalid";
  filterRegions: "invalid" | "tooMany";
  filterTeamIds: "invalid" | "tooMany" | "unknownTeam";
  filterOfficial: "invalid";
  color: "invalid";
}>;

type ActionError = "notAuthenticated" | "forbidden" | "blacklisted" | "notFound" | "invalid" | "tooManySubscriptions" | "channelsUnavailable";
export type SaveDiscordSubscriptionResult = { ok: true } | { ok: false; error: ActionError; fieldErrors?: DiscordSubscriptionFieldErrors };
export type DiscordSubscriptionSimpleResult = { ok: true } | { ok: false; error: "notAuthenticated" | "forbidden" | "blacklisted" | "notFound" };

type ValidSubscription = {
  channelId: string;
  event: DiscordBotEvent;
  locale: string;
  filterRegions: string[];
  filterTeamIds: number[];
  filterOfficial: DiscordBotOfficialFilter;
  color: string | null;
};

/** Signed in user who may manage this server, or the error to return. Blacklisted servers and Discord accounts are refused. */
async function authorizeGuild(guildId: unknown): Promise<{ ok: true; guildId: string; userId: string } | { ok: false; error: "notAuthenticated" | "forbidden" | "blacklisted" }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "notAuthenticated" };
  if (typeof guildId !== "string" || !(await getManageableGuild(userId, guildId))) return { ok: false, error: "forbidden" };
  const [guildBlocked, userBlocked] = await Promise.all([isBlacklisted("guild", guildId), isUserBlacklisted(userId)]);
  if (guildBlocked || userBlocked) return { ok: false, error: "blacklisted" };
  return { ok: true, guildId, userId };
}

async function validateInput(guildId: string, input: DiscordSubscriptionInput): Promise<{ ok: true; value: ValidSubscription } | { ok: false; error: ActionError; fieldErrors?: DiscordSubscriptionFieldErrors }> {
  const fieldErrors: DiscordSubscriptionFieldErrors = {};

  const channelId = typeof input.channelId === "string" ? input.channelId : "";
  if (!channelId) fieldErrors.channelId = "required";
  else {
    const channels = await listGuildTextChannels(guildId);
    if (!channels) return { ok: false, error: "channelsUnavailable" };
    if (!channels.some((c) => c.id === channelId)) fieldErrors.channelId = "unknownChannel";
  }

  if (!(DISCORD_BOT_EVENTS as readonly unknown[]).includes(input.event)) fieldErrors.event = "invalid";
  if (typeof input.locale !== "string" || !(routing.locales as readonly string[]).includes(input.locale)) fieldErrors.locale = "invalid";
  if (!(DISCORD_BOT_OFFICIAL_FILTERS as readonly unknown[]).includes(input.filterOfficial)) fieldErrors.filterOfficial = "invalid";

  // Empty = no override, the server theme applies.
  const color = input.color === null || input.color === "" ? null : input.color;
  if (color !== null && (typeof color !== "string" || !DISCORD_BOT_COLOR_PATTERN.test(color))) fieldErrors.color = "invalid";

  const regions = Array.isArray(input.filterRegions) ? input.filterRegions : null;
  if (!regions || !regions.every((r) => typeof r === "string")) fieldErrors.filterRegions = "invalid";
  else if (regions.length > DISCORD_BOT_LIMITS.filterRegions) fieldErrors.filterRegions = "tooMany";
  else if (regions.length > 0) {
    const known = new Set(await listWebhookRegions());
    if (!regions.every((r) => known.has(r as string))) fieldErrors.filterRegions = "invalid";
  }

  const teamIds = Array.isArray(input.filterTeamIds) ? input.filterTeamIds : null;
  if (!teamIds || !teamIds.every((id) => typeof id === "number" && Number.isInteger(id) && id > 0)) fieldErrors.filterTeamIds = "invalid";
  else if (teamIds.length > DISCORD_BOT_LIMITS.filterTeams) fieldErrors.filterTeamIds = "tooMany";
  else if (teamIds.length > 0) {
    const unique = [...new Set(teamIds as number[])];
    const found = await db.select({ id: teams.id }).from(teams).where(and(inArray(teams.id, unique), eq(teams.isGhost, false)));
    if (found.length !== unique.length) fieldErrors.filterTeamIds = "unknownTeam";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "invalid", fieldErrors };
  return {
    ok: true,
    value: {
      channelId,
      event: input.event as DiscordBotEvent,
      locale: input.locale as string,
      filterRegions: [...new Set(regions as string[])],
      filterTeamIds: [...new Set(teamIds as number[])],
      filterOfficial: input.filterOfficial as DiscordBotOfficialFilter,
      color: color === null ? null : (color as string).toLowerCase(),
    },
  };
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export async function createDiscordSubscription(guildId: string, input: DiscordSubscriptionInput): Promise<SaveDiscordSubscriptionResult> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;

  const validated = await validateInput(auth.guildId, input);
  if (!validated.ok) return validated;

  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(discordBotSubscriptions).where(eq(discordBotSubscriptions.guildId, auth.guildId));
  if (total >= DISCORD_BOT_LIMITS.subscriptionsPerGuild) return { ok: false, error: "tooManySubscriptions" };

  await db.insert(discordBotSubscriptions).values({ guildId: auth.guildId, ...validated.value });
  return { ok: true };
}

export async function updateDiscordSubscription(guildId: string, subscriptionId: number, input: DiscordSubscriptionInput): Promise<SaveDiscordSubscriptionResult> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;
  if (!isId(subscriptionId)) return { ok: false, error: "notFound" };

  const validated = await validateInput(auth.guildId, input);
  if (!validated.ok) return validated;

  // A saved subscription is switched back on: the new channel may be the fix for a lost one.
  const updated = await db
    .update(discordBotSubscriptions)
    .set({ ...validated.value, isActive: true, disabledReason: null, updatedAt: new Date() })
    .where(and(eq(discordBotSubscriptions.id, subscriptionId), eq(discordBotSubscriptions.guildId, auth.guildId)))
    .returning({ id: discordBotSubscriptions.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: "notFound" };
}

export async function setDiscordSubscriptionActive(guildId: string, subscriptionId: number, isActive: boolean): Promise<DiscordSubscriptionSimpleResult> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;
  if (!isId(subscriptionId) || typeof isActive !== "boolean") return { ok: false, error: "notFound" };

  const updated = await db
    .update(discordBotSubscriptions)
    .set({ isActive, disabledReason: null, updatedAt: new Date() })
    .where(and(eq(discordBotSubscriptions.id, subscriptionId), eq(discordBotSubscriptions.guildId, auth.guildId)))
    .returning({ id: discordBotSubscriptions.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: "notFound" };
}

export async function deleteDiscordSubscription(guildId: string, subscriptionId: number): Promise<DiscordSubscriptionSimpleResult> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;
  if (!isId(subscriptionId)) return { ok: false, error: "notFound" };

  const deleted = await db
    .delete(discordBotSubscriptions)
    .where(and(eq(discordBotSubscriptions.id, subscriptionId), eq(discordBotSubscriptions.guildId, auth.guildId)))
    .returning({ id: discordBotSubscriptions.id });
  return deleted.length > 0 ? { ok: true } : { ok: false, error: "notFound" };
}

export type DiscordColorsInput = { live: unknown; finished: unknown; map: unknown; background: unknown; matchButton: unknown };
export type DiscordColorsFieldErrors = Partial<Record<"live" | "finished" | "map" | "background" | "matchButton", "invalid">>;
export type SaveDiscordColorsResult = { ok: true } | { ok: false; error: "notAuthenticated" | "forbidden" | "blacklisted" | "invalid"; fieldErrors?: DiscordColorsFieldErrors };

/** Accent colors, template background and match button of the server, an empty color restores the default. */
export async function saveDiscordColors(guildId: string, input: DiscordColorsInput): Promise<SaveDiscordColorsResult> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;

  const fieldErrors: DiscordColorsFieldErrors = {};
  const values: Record<"live" | "finished" | "map" | "background", string | null> = { live: null, finished: null, map: null, background: null };
  for (const key of ["live", "finished", "map", "background"] as const) {
    const raw = input?.[key];
    if (raw === null || raw === "") continue;
    if (typeof raw !== "string" || !DISCORD_BOT_COLOR_PATTERN.test(raw)) fieldErrors[key] = "invalid";
    else values[key] = raw.toLowerCase();
  }
  if (typeof input?.matchButton !== "boolean") fieldErrors.matchButton = "invalid";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "invalid", fieldErrors };

  const colors = { colorLive: values.live, colorFinished: values.finished, colorMap: values.map, colorBackground: values.background, matchButton: input.matchButton as boolean, updatedAt: new Date() };
  await db.insert(discordBotGuildSettings).values({ guildId: auth.guildId, ...colors }).onConflictDoUpdate({ target: discordBotGuildSettings.guildId, set: colors });
  return { ok: true };
}

export type ConnectDiscordBotResult =
  | { ok: true }
  | { ok: false; error: "notAuthenticated" | "forbidden" | "blacklisted" | "invalid"; fieldErrors?: { token: "required" | "invalidToken" | "rateLimited" } };

const CONNECT_WINDOW_MS = 60_000;
const CONNECT_MAX_PER_WINDOW = 5;

/** Switches the server to its own bot, after checking the token belongs to a bot. */
export async function connectCustomDiscordBot(guildId: string, token: unknown): Promise<ConnectDiscordBotResult> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;

  if (!(await checkRateLimit(`discord-bot-connect:${auth.userId}`, CONNECT_WINDOW_MS, CONNECT_MAX_PER_WINDOW))) return { ok: false, error: "invalid", fieldErrors: { token: "rateLimited" } };

  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) return { ok: false, error: "invalid", fieldErrors: { token: "required" } };
  const identity = trimmed.length <= 200 ? await fetchBotIdentity(trimmed) : null;
  if (!identity) return { ok: false, error: "invalid", fieldErrors: { token: "invalidToken" } };

  const bot = { botTokenEncrypted: encrypt(trimmed), botUserId: identity.userId, botName: identity.name, botAvatarUrl: identity.avatarUrl, updatedAt: new Date() };
  await db.insert(discordBotGuildSettings).values({ guildId: auth.guildId, ...bot }).onConflictDoUpdate({ target: discordBotGuildSettings.guildId, set: bot });
  // Alerts switched off because the previous bot lost a channel get another chance.
  await db.update(discordBotSubscriptions).set({ isActive: true, disabledReason: null, updatedAt: new Date() }).where(eq(discordBotSubscriptions.guildId, auth.guildId));
  return { ok: true };
}

export async function disconnectCustomDiscordBot(guildId: string): Promise<DiscordSubscriptionSimpleResult> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;
  await db
    .update(discordBotGuildSettings)
    .set({ botTokenEncrypted: null, botUserId: null, botName: null, botAvatarUrl: null, updatedAt: new Date() })
    .where(eq(discordBotGuildSettings.guildId, auth.guildId));
  return { ok: true };
}

type TemplateActionError = "notAuthenticated" | "forbidden" | "blacklisted" | "invalid" | "invalidImage" | "tooLarge" | "storageFailed";
export type SaveDiscordTemplateResult = { ok: true } | { ok: false; error: TemplateActionError; issues?: string[] };

const BACKGROUND_MAX_BYTES = 10 * 1024 * 1024;
const BACKGROUND_MIN_SIDE = 400;
const BACKGROUND_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Authorized server and a valid alert type. */
async function authorizeEvent(guildId: unknown, event: unknown): Promise<{ ok: true; guildId: string; userId: string; event: DiscordBotEvent } | { ok: false; error: TemplateActionError }> {
  const auth = await authorizeGuild(guildId);
  if (!auth.ok) return auth;
  if (!(DISCORD_BOT_EVENTS as readonly unknown[]).includes(event)) return { ok: false, error: "invalid" };
  return { ok: true, guildId: auth.guildId, userId: auth.userId, event: event as DiscordBotEvent };
}

/** Writes the template of an alert type and puts it back in the review queue. */
async function writeTemplate(auth: { guildId: string; userId: string; event: DiscordBotEvent }, template: AlertTemplate, imagePins: Record<string, string>): Promise<void> {
  const values = { template, imagePins, updatedAt: new Date() };
  await db
    .insert(discordBotTemplates)
    .values({ guildId: auth.guildId, event: auth.event, ...values })
    .onConflictDoUpdate({ target: [discordBotTemplates.guildId, discordBotTemplates.event], set: values });
  await queueTemplateReview({ guildId: auth.guildId, event: auth.event, userId: auth.userId, template });
}

async function currentBackgroundId(guildId: string, event: DiscordBotEvent): Promise<string | null> {
  return (await getGuildTemplates(guildId)).get(event)?.template.backgroundImageId ?? null;
}

/** Saves the layers of a template. The background is only ever changed by its own actions. */
export async function saveDiscordTemplate(guildId: string, event: DiscordBotEvent, input: unknown): Promise<SaveDiscordTemplateResult> {
  const auth = await authorizeEvent(guildId, event);
  if (!auth.ok) return auth;

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) };

  const template = { ...parsed.data, backgroundImageId: await currentBackgroundId(auth.guildId, auth.event) };
  const { pins, unreachable } = await pinExternalImages(template);
  if (unreachable.length > 0) return { ok: false, error: "invalid", issues: unreachable.map((url) => `url: image not reachable (${url.slice(0, 80)})`) };
  await writeTemplate(auth, template, pins);
  return { ok: true };
}

/** Replaces the background image of a template, creating the default template when there is none yet. */
export async function uploadDiscordBackground(guildId: string, event: DiscordBotEvent, formData: FormData): Promise<SaveDiscordTemplateResult> {
  const auth = await authorizeEvent(guildId, event);
  if (!auth.ok) return auth;

  const file = formData.get("file");
  if (!(file instanceof File) || !BACKGROUND_TYPES.includes(file.type)) return { ok: false, error: "invalidImage" };
  if (file.size > BACKGROUND_MAX_BYTES) return { ok: false, error: "tooLarge" };
  const buffer = Buffer.from(await file.arrayBuffer());
  const checked = await validateImageBuffer(buffer);
  if (!checked.ok || Math.min(checked.width, checked.height) < BACKGROUND_MIN_SIDE) return { ok: false, error: "invalidImage" };

  let stored;
  try {
    stored = await storeDiscordBackground(buffer);
  } catch (error) {
    console.error("[discord-bot] background upload failed (%s)", auth.event, error);
    return { ok: false, error: "storageFailed" };
  }

  const stored_ = (await getGuildTemplates(auth.guildId)).get(auth.event);
  const existing = stored_?.template;
  const template = { ...(existing ?? createDefaultTemplate(auth.event === "match_live" ? "live" : auth.event === "map_finished" ? "map" : "finished", "score", (await getGuildSettings(auth.guildId))?.colorBackground ?? DISCORD_BOT_DEFAULT_BACKGROUND)), backgroundImageId: stored.id };
  try {
    await writeTemplate(auth, template, stored_?.imagePins ?? {});
  } catch (error) {
    // The new file is not referenced by anything, do not leave it behind.
    await deleteDiscordBackground(stored.id).catch(() => undefined);
    throw error;
  }
  if (existing?.backgroundImageId) await deleteDiscordBackground(existing.backgroundImageId).catch(() => undefined);
  return { ok: true };
}

export async function removeDiscordBackground(guildId: string, event: DiscordBotEvent): Promise<SaveDiscordTemplateResult> {
  const auth = await authorizeEvent(guildId, event);
  if (!auth.ok) return auth;
  const existing = (await getGuildTemplates(auth.guildId)).get(auth.event)?.template;
  if (!existing?.backgroundImageId) return { ok: true };
  await db
    .update(discordBotTemplates)
    .set({ template: { ...existing, backgroundImageId: null }, updatedAt: new Date() })
    .where(and(eq(discordBotTemplates.guildId, auth.guildId), eq(discordBotTemplates.event, auth.event)));
  await deleteDiscordBackground(existing.backgroundImageId).catch(() => undefined);
  await queueTemplateReview({ guildId: auth.guildId, event: auth.event, userId: auth.userId, template: { ...existing, backgroundImageId: null } });
  return { ok: true };
}

/** Picks the ready-made design of an alert type, open to every server. "none" goes back to the text embed. */
export async function chooseDiscordTemplatePreset(guildId: string, event: DiscordBotEvent, preset: unknown): Promise<SaveDiscordTemplateResult> {
  const auth = await authorizeEvent(guildId, event);
  if (!auth.ok) return auth;
  if (preset === "none") return deleteTemplateRow(auth.guildId, auth.event);
  const kind = KIND_BY_EVENT[auth.event];
  if (typeof preset !== "string" || !(presetsOf(kind) as string[]).includes(preset)) return { ok: false, error: "invalid" };

  const template = { ...createDefaultTemplate(kind, preset as TemplatePreset, (await getGuildSettings(auth.guildId))?.colorBackground ?? DISCORD_BOT_DEFAULT_BACKGROUND), backgroundImageId: await currentBackgroundId(auth.guildId, auth.event) };
  await writeTemplate(auth, template, {});
  return { ok: true };
}

async function deleteTemplateRow(guildId: string, event: DiscordBotEvent): Promise<SaveDiscordTemplateResult> {
  const existing = (await getGuildTemplates(guildId)).get(event)?.template;
  await db.delete(discordBotTemplates).where(and(eq(discordBotTemplates.guildId, guildId), eq(discordBotTemplates.event, event)));
  if (existing?.backgroundImageId) await deleteDiscordBackground(existing.backgroundImageId).catch(() => undefined);
  await dropTemplateReview(guildId, event);
  return { ok: true };
}

/** Back to the plain text embed for this alert type. */
export async function deleteDiscordTemplate(guildId: string, event: DiscordBotEvent): Promise<SaveDiscordTemplateResult> {
  const auth = await authorizeEvent(guildId, event);
  if (!auth.ok) return auth;
  return deleteTemplateRow(auth.guildId, auth.event);
}

export type SendTestAlertResult =
  | { ok: true }
  | { ok: false; error: TemplateActionError | "rateLimited" | "channelsUnavailable" | "sendFailed"; fieldErrors?: { channelId: "required" | "unknownChannel" }; issues?: string[] };

const TEST_COOLDOWN_MS = 10_000;
const KIND_BY_EVENT = { match_live: "live", match_finished: "finished", map_finished: "map" } as const;
const COLOR_FIELD_BY_EVENT = { match_live: "colorLive", match_finished: "colorFinished", map_finished: "colorMap" } as const;

/** Posts the template being edited, filled with the preview match, in a channel of the server. */
export async function sendDiscordTestAlert(guildId: string, event: DiscordBotEvent, channelId: unknown, locale: unknown, input: unknown): Promise<SendTestAlertResult> {
  const auth = await authorizeEvent(guildId, event);
  if (!auth.ok) return auth;

  if (typeof channelId !== "string" || !channelId) return { ok: false, error: "invalid", fieldErrors: { channelId: "required" } };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const resolvedLocale = typeof locale === "string" && (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;

  const channels = await listGuildTextChannels(auth.guildId);
  if (!channels) return { ok: false, error: "channelsUnavailable" };
  if (!channels.some((c) => c.id === channelId)) return { ok: false, error: "invalid", fieldErrors: { channelId: "unknownChannel" } };

  if (!(await checkRateLimit(`discord-bot-test:${auth.guildId}`, TEST_COOLDOWN_MS, 1))) return { ok: false, error: "rateLimited" };

  const settings = await getGuildSettings(auth.guildId);
  const kind = KIND_BY_EVENT[auth.event];
  const template = { ...parsed.data, backgroundImageId: await currentBackgroundId(auth.guildId, auth.event) };
  try {
    const { matchId, fields, images } = await resolvePreviewData(kind, resolvedLocale);
    const url = `${GCS_SITE_URL}/${resolvedLocale}/match/${matchId}`;
    const png = await renderTemplateImage(template, { fields, images, locale: resolvedLocale, footerUrl: url.replace(/^https?:\/\//, "") });
    const message = composeAlertMessage({
      kind,
      fields,
      accent: settings?.[COLOR_FIELD_BY_EVENT[auth.event]] ?? DISCORD_BOT_DEFAULT_COLORS[kind],
      image: png,
      url,
      buttonLabel: settings?.matchButton === false ? null : await resolveMatchButtonLabel(resolvedLocale),
    });
    const result = await postChannelMessage(resolveBotToken(settings), channelId, message.components, message.attachment);
    if (!result.ok) {
      console.warn("[discord-bot] test alert not sent (%s, %s)", auth.event, result.error);
      return { ok: false, error: "sendFailed" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[discord-bot] test alert failed (%s)", auth.event, error);
    return { ok: false, error: "sendFailed" };
  }
}

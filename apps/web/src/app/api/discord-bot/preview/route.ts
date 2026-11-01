/**
 * GC-Stats - route
 *
 * PNG preview of a server's alert template filled with a real match (sample data when it is missing), for the dashboard.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { isBlacklisted, isUserBlacklisted } from "@/lib/discord-bot/moderation";
import { getCurrentUserId } from "@/lib/session";
import { getGuildSettings } from "@/lib/discord-bot/settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkManageableGuild } from "@/lib/discord-bot/guilds";
import { renderTemplateImage } from "@/lib/discord-bot/image";
import { resolvePreviewData } from "@/lib/discord-bot/preview";
import type { AlertKind } from "@/lib/discord-bot/render";
import { DISCORD_BOT_DEFAULT_BACKGROUND, DISCORD_BOT_EVENTS, GCS_SITE_URL, type DiscordBotEvent } from "@/lib/discord-bot/shared";
import { getGuildTemplates } from "@/lib/discord-bot/templates";
import { createDefaultTemplate, externalImageUrls, presetsOf, templateSchema, type AlertTemplate, type TemplatePreset } from "@/lib/discord-bot/template";
import { routing } from "@/i18n/routing";

const KIND_BY_EVENT: Record<DiscordBotEvent, AlertKind> = { match_live: "live", match_finished: "finished", map_finished: "map" };

const MAX_BODY_BYTES = 256 * 1024;
const PREVIEW_WINDOW_MS = 60_000;
const PREVIEW_MAX_PER_WINDOW = 90;
// Renders that download external pictures are costlier, they get their own tighter budget.
const EXTERNAL_PREVIEW_MAX_PER_WINDOW = 20;

/** Null when the user may manage the guild, otherwise the error response. */
async function authorizeGuild(userId: string, guildId: string): Promise<Response | null> {
  const access = await checkManageableGuild(userId, guildId);
  if (access === "unavailable") return NextResponse.json({ error: "Discord unavailable" }, { status: 503 });
  if (access === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [guildBlocked, userBlocked] = await Promise.all([isBlacklisted("guild", guildId), isUserBlacklisted(userId)]);
  if (guildBlocked || userBlocked) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await checkRateLimit(`discord-bot-preview:${userId}`, PREVIEW_WINDOW_MS, PREVIEW_MAX_PER_WINDOW))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  return null;
}

async function renderPreview(userId: string, event: DiscordBotEvent, locale: string, template: AlertTemplate, imagePins?: Record<string, string>): Promise<Response> {
  if (!(DISCORD_BOT_EVENTS as readonly string[]).includes(event)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  if (externalImageUrls(template).length > 0 && !(await checkRateLimit(`discord-bot-preview-external:${userId}`, PREVIEW_WINDOW_MS, EXTERNAL_PREVIEW_MAX_PER_WINDOW))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const kind = KIND_BY_EVENT[event];
  const { matchId, fields, images } = await resolvePreviewData(kind, locale);
  try {
    const png = await renderTemplateImage(template, { fields, images, locale, footerUrl: `${GCS_SITE_URL.replace(/^https?:\/\//, "")}/${locale}/match/${matchId}`, imagePins });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[discord-bot] preview render failed (%s)", event, error);
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}

function resolveLocale(value: unknown): string {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

/** Saved template of the server, or a default design when `preset` is given (open to every server, the GC Stats bot uses them). */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const guildId = params.get("guildId") ?? "";
  const event = params.get("event") as DiscordBotEvent;
  const preset = params.get("preset");
  if (preset) {
    const kind = KIND_BY_EVENT[event];
    if (!kind || !(presetsOf(kind) as string[]).includes(preset)) return NextResponse.json({ error: "Invalid preset" }, { status: 400 });
    const denied = await authorizeGuild(userId, guildId);
    if (denied) return denied;
    return renderPreview(userId, event, resolveLocale(params.get("locale")), createDefaultTemplate(kind, preset as TemplatePreset, (await getGuildSettings(guildId))?.colorBackground ?? DISCORD_BOT_DEFAULT_BACKGROUND));
  }
  // Checked before the lookup so a server's templates are not probed by outsiders.
  const denied = await authorizeGuild(userId, guildId);
  if (denied) return denied;
  const stored = (await getGuildTemplates(guildId)).get(event);
  if (!stored) return NextResponse.json({ error: "No template" }, { status: 404 });
  return renderPreview(userId, event, resolveLocale(params.get("locale")), stored.template, stored.imagePins);
}

/** Template being edited, not saved yet. Its background always comes from the saved template. */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const body = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })() as { guildId?: unknown; event?: unknown; locale?: unknown; template?: unknown } | null;
  const parsed = templateSchema.safeParse(body?.template);
  if (!body || typeof body.guildId !== "string" || !parsed.success) return NextResponse.json({ error: "Invalid template" }, { status: 400 });

  const denied = await authorizeGuild(userId, body.guildId);
  if (denied) return denied;
  const event = body.event as DiscordBotEvent;
  const saved = (await getGuildTemplates(body.guildId)).get(event);
  return renderPreview(userId, event, resolveLocale(body.locale), { ...parsed.data, backgroundImageId: saved?.template.backgroundImageId ?? null });
}

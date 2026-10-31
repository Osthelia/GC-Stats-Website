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
import { getCurrentUserId } from "@/lib/session";
import { getGuildSettings } from "@/lib/discord-bot/settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { getManageableGuild } from "@/lib/discord-bot/guilds";
import { renderTemplateImage } from "@/lib/discord-bot/image";
import { resolvePreviewData } from "@/lib/discord-bot/preview";
import type { AlertKind } from "@/lib/discord-bot/render";
import { DISCORD_BOT_EVENTS, GCS_SITE_URL, type DiscordBotEvent } from "@/lib/discord-bot/shared";
import { getGuildTemplates } from "@/lib/discord-bot/templates";
import { templateSchema, type AlertTemplate } from "@/lib/discord-bot/template";
import { routing } from "@/i18n/routing";

const KIND_BY_EVENT: Record<DiscordBotEvent, AlertKind> = { match_live: "live", match_finished: "finished", map_finished: "map" };

const MAX_BODY_BYTES = 256 * 1024;
const PREVIEW_WINDOW_MS = 60_000;
const PREVIEW_MAX_PER_WINDOW = 30;

/** The guild when the user may manage it and runs its own bot (image templates are reserved to those), otherwise the error response. */
async function authorizeGuild(userId: string, guildId: string): Promise<Response | null> {
  if (!(await getManageableGuild(userId, guildId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await getGuildSettings(guildId))?.botTokenEncrypted) return NextResponse.json({ error: "Custom bot required" }, { status: 403 });
  if (!(await checkRateLimit(`discord-bot-preview:${userId}`, PREVIEW_WINDOW_MS, PREVIEW_MAX_PER_WINDOW))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  return null;
}

async function renderPreview(event: DiscordBotEvent, locale: string, template: AlertTemplate): Promise<Response> {
  if (!(DISCORD_BOT_EVENTS as readonly string[]).includes(event)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  const kind = KIND_BY_EVENT[event];
  const { matchId, fields, images } = await resolvePreviewData(kind, locale);
  try {
    const png = await renderTemplateImage(template, { fields, images, locale, footerUrl: `${GCS_SITE_URL.replace(/^https?:\/\//, "")}/${locale}/match/${matchId}` });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[discord-bot] preview render failed (%s)", event, error);
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}

function resolveLocale(value: unknown): string {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

/** Saved template of the server. */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const guildId = params.get("guildId") ?? "";
  const event = params.get("event") as DiscordBotEvent;
  // Checked before the lookup so a server's templates are not probed by outsiders.
  const denied = await authorizeGuild(userId, guildId);
  if (denied) return denied;
  const stored = (await getGuildTemplates(guildId)).get(event);
  if (!stored) return NextResponse.json({ error: "No template" }, { status: 404 });
  return renderPreview(event, resolveLocale(params.get("locale")), stored.template);
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
  return renderPreview(event, resolveLocale(body.locale), { ...parsed.data, backgroundImageId: saved?.template.backgroundImageId ?? null });
}

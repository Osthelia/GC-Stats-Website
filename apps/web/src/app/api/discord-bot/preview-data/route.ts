/**
 * GC-Stats - route
 *
 * Texts and pictures of the preview match, for the template editor canvas.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { isBlacklisted, isUserBlacklisted } from "@/lib/discord-bot/moderation";
import { getManageableGuild } from "@/lib/discord-bot/guilds";
import { resolvePreviewData } from "@/lib/discord-bot/preview";
import { DISCORD_BOT_EVENTS, type DiscordBotEvent } from "@/lib/discord-bot/shared";
import type { AlertKind } from "@/lib/discord-bot/render";
import { routing } from "@/i18n/routing";

const KIND_BY_EVENT: Record<DiscordBotEvent, AlertKind> = { match_live: "live", match_finished: "finished", map_finished: "map" };

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const event = params.get("event") as DiscordBotEvent;
  if (!(DISCORD_BOT_EVENTS as readonly string[]).includes(event)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const guildId = params.get("guildId") ?? "";
  if (!(await getManageableGuild(userId, guildId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [guildBlocked, userBlocked] = await Promise.all([isBlacklisted("guild", guildId), isUserBlacklisted(userId)]);
  if (guildBlocked || userBlocked) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const locale = params.get("locale") ?? "";
  const resolved = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  return NextResponse.json(await resolvePreviewData(KIND_BY_EVENT[event], resolved), { headers: { "Cache-Control": "private, no-store" } });
}

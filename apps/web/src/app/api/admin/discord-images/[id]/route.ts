/**
 * GC-Stats - route
 *
 * PNG of the alert template under review, filled with a real match, for the moderators.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { discordBotImageReviews, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { renderTemplateImage } from "@/lib/discord-bot/image";
import { resolvePreviewData } from "@/lib/discord-bot/preview";
import { GCS_SITE_URL, type DiscordBotEvent } from "@/lib/discord-bot/shared";
import { getGuildTemplates } from "@/lib/discord-bot/templates";
import type { AlertKind } from "@/lib/discord-bot/render";
import { routing } from "@/i18n/routing";

const KIND_BY_EVENT: Record<DiscordBotEvent, AlertKind> = { match_live: "live", match_finished: "finished", map_finished: "map" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActorPermission(PERMISSIONS.moderationView);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [review] = await db.select().from(discordBotImageReviews).where(eq(discordBotImageReviews.id, id)).limit(1);
  const event = review?.event as DiscordBotEvent | undefined;
  const stored = review && event ? (await getGuildTemplates(review.guildId)).get(event) : undefined;
  if (!event || !stored) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const locale = routing.defaultLocale;
    const { matchId, fields, images } = await resolvePreviewData(KIND_BY_EVENT[event], locale);
    const png = await renderTemplateImage(stored.template, { fields, images, locale, footerUrl: `${GCS_SITE_URL.replace(/^https?:\/\//, "")}/${locale}/match/${matchId}`, imagePins: stored.imagePins });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[discord-bot] review render failed (review #%d)", id, error);
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}

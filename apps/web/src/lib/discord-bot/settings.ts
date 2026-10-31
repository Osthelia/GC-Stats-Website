/**
 * GC-Stats - settings
 *
 * Theme of each Discord server: its own bot (token kept encrypted) and embed colors.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { discordBotGuildSettings } from "@gc-stats/db";
import { decrypt } from "@/lib/encryption";
import type { DiscordBotSettingsView } from "./shared";

export type GuildSettings = typeof discordBotGuildSettings.$inferSelect;

/** Token of the server's own bot, null when it uses the GC Stats bot. */
export function customBotToken(settings: Pick<GuildSettings, "botTokenEncrypted"> | undefined): string | null {
  if (!settings?.botTokenEncrypted) return null;
  try {
    return decrypt(settings.botTokenEncrypted);
  } catch {
    return null;
  }
}

/** Bot token to act with in a server: its own bot when set, the GC Stats bot otherwise. */
export function resolveBotToken(settings: Pick<GuildSettings, "botTokenEncrypted"> | undefined): string | null {
  return customBotToken(settings) ?? process.env.GCS_DISCORD_BOT_TOKEN ?? null;
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
  const [row] = await db.select().from(discordBotGuildSettings).where(eq(discordBotGuildSettings.guildId, guildId));
  return row;
}

export async function listGuildSettings(guildIds: string[]): Promise<Map<string, GuildSettings>> {
  if (guildIds.length === 0) return new Map();
  const query = () => db.select().from(discordBotGuildSettings).where(inArray(discordBotGuildSettings.guildId, guildIds));
  // One retry covers a dropped pooled connection.
  const rows = await query().catch((error) => {
    console.warn("[discord-bot] guild settings read failed, retrying", error);
    return query();
  });
  return new Map(rows.map((r) => [r.guildId, r]));
}

export function toSettingsView(settings: GuildSettings | undefined): DiscordBotSettingsView {
  return {
    bot: settings?.botTokenEncrypted && settings.botUserId ? { userId: settings.botUserId, name: settings.botName ?? "", avatarUrl: settings.botAvatarUrl } : null,
    matchButton: settings?.matchButton ?? true,
    colors: { live: settings?.colorLive ?? null, finished: settings?.colorFinished ?? null, map: settings?.colorMap ?? null },
  };
}

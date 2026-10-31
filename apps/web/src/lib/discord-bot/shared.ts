/**
 * GC-Stats - shared
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { AlertTemplate } from "./template";

// View Channel + Send Messages + Embed Links
const GCS_BOT_PERMISSIONS = "19456";

// Null until the bot application is configured, callers hide the invite button then.
// With a guild id, the server is preselected and locked in Discord's invite screen.
// `clientId` is the application of a custom bot, the GC Stats one by default.
export function getGcsBotInviteUrl(guildId?: string, clientId = process.env.GCS_DISCORD_BOT_CLIENT_ID): string | null {
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands",
    permissions: GCS_BOT_PERMISSIONS,
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export const DISCORD_BOT_EVENTS = ["match_live", "match_finished", "map_finished"] as const;
export type DiscordBotEvent = (typeof DISCORD_BOT_EVENTS)[number];

export const DISCORD_BOT_OFFICIAL_FILTERS = ["all", "official", "unofficial"] as const;
export type DiscordBotOfficialFilter = (typeof DISCORD_BOT_OFFICIAL_FILTERS)[number];

export const DISCORD_BOT_LIMITS = {
  filterRegions: 20,
  filterTeams: 50,
  subscriptionsPerGuild: 25,
} as const;

export const DISCORD_IMAGE_SANCTION_REASON_MAX = 500;

// Content hash of a posted message whose image moderation removed: queued for the bot to edit, then done.
export const MESSAGE_IMAGE_REMOVAL_QUEUED_HASH = "image-removal-queued";
export const MESSAGE_IMAGE_REMOVED_HASH = "image-removed";

export const DISCORD_BOT_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// Default embed colors per alert kind.
export const DISCORD_BOT_DEFAULT_COLORS = { live: "#e74c3c", finished: "#e4ae22", map: "#e4ae22" } as const;
export type DiscordBotColorKey = keyof typeof DISCORD_BOT_DEFAULT_COLORS;

// Default background of the image templates: the site's dark background.
export const DISCORD_BOT_DEFAULT_BACKGROUND = "#0e0e0e";
export const DISCORD_BOT_THEME_DEFAULTS = { ...DISCORD_BOT_DEFAULT_COLORS, background: DISCORD_BOT_DEFAULT_BACKGROUND } as const;
export type DiscordBotThemeColorKey = keyof typeof DISCORD_BOT_THEME_DEFAULTS;

export function hexToInt(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

export const GCS_SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type DiscordBotGuild = { id: string; name: string; iconUrl: string | null; botJoined: boolean };
export type DiscordBotChannel = { id: string; name: string };

/** Theme of a server, as shown in the dashboard (never carries the bot token). */
export type DiscordBotSettingsView = {
  bot: { userId: string; name: string; avatarUrl: string | null } | null;
  colors: Record<DiscordBotThemeColorKey, string | null>;
  /** Link button to the match under each alert. */
  matchButton: boolean;
};

/** Image template of an alert type, as shown in the dashboard. `updatedAt` busts the preview cache. */
export type DiscordBotTemplateView = { event: DiscordBotEvent; template: AlertTemplate; backgroundUrl: string | null; hasBackground: boolean; updatedAt: number };

export type DiscordBotSubscriptionView = {
  id: number;
  channelId: string;
  event: DiscordBotEvent;
  locale: string;
  filterRegions: string[];
  filterTeams: { id: number; name: string }[];
  filterOfficial: DiscordBotOfficialFilter;
  color: string | null;
  isActive: boolean;
  disabledReason: string | null;
};

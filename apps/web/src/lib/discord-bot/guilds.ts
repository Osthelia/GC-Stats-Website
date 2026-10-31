/**
 * GC-Stats - guilds
 *
 * Discord servers of the bot dashboard: the ones a user may manage, whether
 * the bot joined them, and their text channels.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import { getDiscordAccessToken } from "@/lib/discord-guild-membership";
import { customBotToken, getGuildSettings, listGuildSettings, resolveBotToken } from "./settings";
import type { DiscordBotChannel, DiscordBotGuild } from "./shared";

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_TIMEOUT_MS = 5000;
const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);
// Guild text and announcement channels.
const TEXT_CHANNEL_TYPES = [0, 5];

type UserGuild = { id: string; name: string; icon: string | null; owner: boolean; permissions: string };

export type GuildsResult = { ok: true; guilds: DiscordBotGuild[] } | { ok: false; error: "notLinked" | "unavailable" };

const CACHE_TTL_MS = 60_000;
// A failed call may fall back to an older answer, but not for long.
const STALE_MAX_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;
const responseCache = new Map<string, { at: number; data: unknown }>();

/** Cache key that never keeps the token itself. */
function cacheKey(authorization: string, path: string): string {
  return `${crypto.createHash("sha256").update(authorization).digest("hex")}${path}`;
}

function remember(key: string, data: unknown): void {
  responseCache.delete(key);
  responseCache.set(key, { at: Date.now(), data });
  // Oldest entries first (Map keeps insertion order).
  for (const oldest of responseCache.keys()) {
    if (responseCache.size <= CACHE_MAX_ENTRIES) break;
    responseCache.delete(oldest);
  }
}

/** GET on the Discord API, cached briefly per caller. A transient failure falls back to a recent answer so rate limits and timeouts do not lock users out. */
async function discordGet<T>(path: string, authorization: string): Promise<T | null> {
  const key = cacheKey(authorization, path);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data as T;
  const stale = cached && Date.now() - cached.at < STALE_MAX_MS ? (cached.data as T) : null;
  try {
    const response = await fetch(`${DISCORD_API}${path}`, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) {
      console.warn("[discord-bot] discord request failed (%s, status %d)", path.split("?")[0], response.status);
      // A rejected token or a missing permission must not keep serving the old answer.
      if (response.status === 401 || response.status === 403) {
        responseCache.delete(key);
        return null;
      }
      return stale;
    }
    const data = (await response.json()) as T;
    remember(key, data);
    return data;
  } catch (error) {
    console.warn("[discord-bot] discord request errored (%s)", path.split("?")[0], error);
    return stale;
  }
}

const GUILDS_PAGE_SIZE = 200;
const GUILDS_MAX_PAGES = 50;

/** Ids of every server the bot joined, read page by page. */
async function listBotGuildIds(token: string | null): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!token) return ids;
  let after = "";
  for (let page = 0; page < GUILDS_MAX_PAGES; page++) {
    const guilds = await discordGet<{ id: string }[]>(`/users/@me/guilds?limit=${GUILDS_PAGE_SIZE}${after}`, `Bot ${token}`);
    if (!guilds || guilds.length === 0) break;
    for (const g of guilds) ids.add(g.id);
    if (guilds.length < GUILDS_PAGE_SIZE) break;
    after = `&after=${guilds[guilds.length - 1]?.id}`;
  }
  return ids;
}

function canManage(guild: UserGuild): boolean {
  if (guild.owner) return true;
  try {
    const permissions = BigInt(guild.permissions);
    return (permissions & ADMINISTRATOR) !== BigInt(0) || (permissions & MANAGE_GUILD) !== BigInt(0);
  } catch {
    return false;
  }
}

/** Servers the user owns or holds Administrator or Manage Server on, read live from their Discord account. */
export async function listManageableGuilds(userId: string): Promise<GuildsResult> {
  const accessToken = await getDiscordAccessToken(userId);
  if (!accessToken) return { ok: false, error: "notLinked" };

  const [userGuilds, defaultBotGuildIds] = await Promise.all([discordGet<UserGuild[]>("/users/@me/guilds", `Bearer ${accessToken}`), listBotGuildIds(process.env.GCS_DISCORD_BOT_TOKEN ?? null)]);
  if (!userGuilds) return { ok: false, error: "unavailable" };

  const manageable = userGuilds.filter(canManage);
  // A server with its own bot is joined when that bot is in it, whatever the GC Stats bot does.
  const settings = await listGuildSettings(manageable.map((g) => g.id));
  const customJoined = new Map<string, Set<string>>();
  const guilds = (
    await Promise.all(
      manageable.map(async (g) => {
        const token = customBotToken(settings.get(g.id));
        let botJoined = defaultBotGuildIds.has(g.id);
        if (token) {
          if (!customJoined.has(token)) customJoined.set(token, await listBotGuildIds(token));
          botJoined = customJoined.get(token)?.has(g.id) ?? false;
        }
        return { id: g.id, name: g.name, iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null, botJoined };
      }),
    )
  )
    .sort((a, b) => Number(b.botJoined) - Number(a.botJoined) || a.name.localeCompare(b.name));
  return { ok: true, guilds };
}

/** The guild when the user may manage it, null otherwise (never trust a guild id sent by the client). */
export async function getManageableGuild(userId: string, guildId: string): Promise<DiscordBotGuild | null> {
  if (!/^\d{15,25}$/.test(guildId)) return null;
  const result = await listManageableGuilds(userId);
  return result.ok ? (result.guilds.find((g) => g.id === guildId) ?? null) : null;
}

/** Text channels of a guild the bot joined, null when the bot cannot read them. */
export async function listGuildTextChannels(guildId: string): Promise<DiscordBotChannel[] | null> {
  if (!/^\d{15,25}$/.test(guildId)) return null;
  const token = resolveBotToken(await getGuildSettings(guildId));
  if (!token) return null;
  const channels = await discordGet<{ id: string; name: string; type: number; position: number }[]>(`/guilds/${guildId}/channels`, `Bot ${token}`);
  if (!channels) return null;
  return channels
    .filter((c) => TEXT_CHANNEL_TYPES.includes(c.type))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));
}

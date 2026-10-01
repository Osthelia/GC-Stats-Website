/**
 * GC-Stats - discord-guild-membership
 *
 * Checks whether a user's linked Discord account belongs to a given guild,
 * refreshing the stored OAuth token when it's expired.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, and } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { accounts } from "@gc-stats/db";

interface DiscordGuild {
  id: string;
}

interface DiscordTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse | null> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
    });
    if (!response.ok) return null;
    return (await response.json()) as DiscordTokenResponse;
  } catch {
    return null;
  }
}

/** Discord account linked via OAuth (settings/account "Connect"), null if none. */
export async function getLinkedDiscordId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ providerAccountId: accounts.providerAccountId })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "discord")))
    .limit(1);
  return row?.providerAccountId ?? null;
}

/**
 * Checks the user's linked Discord account is a member of DISCORD_GUILD_ID,
 * via the "guilds" OAuth scope on their own access token. Refreshes an
 * expired token in place. Never throws — an API/network failure reads as
 * "not joined" rather than blocking the settings page.
 */
export async function hasJoinedDiscordGuild(userId: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return false;

  try {
    const [row] = await db
      .select({ accessToken: accounts.access_token, refreshToken: accounts.refresh_token, expiresAt: accounts.expires_at })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, "discord")))
      .limit(1);
    if (!row?.accessToken) return false;

    let accessToken = row.accessToken;
    const isExpired = row.expiresAt !== null && row.expiresAt * 1000 < Date.now();
    if (isExpired) {
      if (!row.refreshToken) return false;
      const refreshed = await refreshAccessToken(row.refreshToken);
      if (!refreshed) return false;
      accessToken = refreshed.access_token;
      await db
        .update(accounts)
        .set({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? row.refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
        })
        .where(and(eq(accounts.userId, userId), eq(accounts.provider, "discord")));
    }

    const response = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return false;

    const guilds = (await response.json()) as DiscordGuild[];
    return guilds.some((g) => g.id === guildId);
  } catch (error) {
    console.warn("[discord-guild-membership] failed to check guild membership", error);
    return false;
  }
}

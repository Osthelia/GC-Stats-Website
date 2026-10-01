/**
 * GC-Stats - discord-invite
 *
 * Single source of truth for the site's Discord invite link and its
 * display label, overridable via an env var.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const DISCORD_INVITE_URL = process.env.DISCORD_INVITE_URL || "https://discord.gg/kFHNN8cDXJ";
export const DISCORD_INVITE_LABEL = DISCORD_INVITE_URL.replace(/^https?:\/\//, "");

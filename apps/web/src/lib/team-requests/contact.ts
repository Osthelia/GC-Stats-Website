/**
 * GC-Stats - team-requests contact
 *
 * Turns a stored contact into a link that opens it, when there is one.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { TeamRequestContactChannel } from "@/lib/team-requests/constants";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const DISCORD_ID_PATTERN = /^\d{15,25}$/;
const DISCORD_INVITE_PATTERN = /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)[\w-]+\/?$/i;

/** A Discord contact is a user ID or an invite link, never a handle. */
export function isDiscordContact(value: string): boolean {
  return DISCORD_ID_PATTERN.test(value) || DISCORD_INVITE_PATTERN.test(value);
}

/** Null when the value cannot be opened. */
export function contactHref(channel: TeamRequestContactChannel, rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (channel === "email") return isEmail(value) ? `mailto:${value}` : null;
  if (channel === "discord") {
    if (DISCORD_ID_PATTERN.test(value)) return `https://discord.com/users/${value}`;
    if (!DISCORD_INVITE_PATTERN.test(value)) return null;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }
  if (isHttpUrl(value)) return value;

  if (channel === "twitter") {
    const handle = value.replace(/^@/, "");
    return /^\w{1,30}$/.test(handle) ? `https://x.com/${handle}` : null;
  }
  // Website or free field written without a scheme.
  const withScheme = `https://${value}`;
  return /^[^\s/]+\.[^\s/]+/.test(value) && isHttpUrl(withScheme) ? withScheme : null;
}

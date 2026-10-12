/**
 * GC-Stats - person-social-keys
 *
 * Shared by admin (actions/admin-players.ts), /dashboard
 * (actions/dashboard-organizations.ts) and the suggest-edit flow. No
 * "website" key here: unlike teams, players never have a website field.
 * "discord" holds a Discord user ID or a server invite.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { isValidUrl } from "@/lib/admin-validation";

export const PERSON_SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord"] as const;
export type PersonSocialKey = (typeof PERSON_SOCIAL_KEYS)[number];

/** Discord snowflake: 17 to 20 digits. */
export const DISCORD_USER_ID_RE = /^\d{17,20}$/;

/** discord.gg/code, discord.com/invite/code or discordapp.com/invite/code, scheme optional. */
const DISCORD_INVITE_RE = /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?$/i;

export function isDiscordUserId(value: string): boolean {
  return DISCORD_USER_ID_RE.test(value);
}

export function discordUserUrl(discordUserId: string): string {
  return `https://discord.com/users/${discordUserId}`;
}

/** Normalizes a Discord value (user ID or invite) to what gets stored, null when it is neither. */
export function normalizeDiscordValue(value: string): string | null {
  const trimmed = value.trim();
  if (isDiscordUserId(trimmed)) return trimmed;
  const invite = DISCORD_INVITE_RE.exec(trimmed);
  return invite ? `https://discord.gg/${invite[1]}` : null;
}

/** Link for a stored Discord value, null when it is neither a user ID nor an invite. */
export function discordHref(value: string): string | null {
  const normalized = normalizeDiscordValue(value);
  if (!normalized) return null;
  return isDiscordUserId(normalized) ? discordUserUrl(normalized) : normalized;
}

/** Error code for one person social value (already trimmed, non empty), null when valid. */
export function personSocialError(key: PersonSocialKey, value: string): "tooLong" | "invalid" | "invalidDiscordId" | null {
  if (key === "discord") return normalizeDiscordValue(value) ? null : "invalidDiscordId";
  if (value.length > 2000) return "tooLong";
  return isValidUrl(value) ? null : "invalid";
}

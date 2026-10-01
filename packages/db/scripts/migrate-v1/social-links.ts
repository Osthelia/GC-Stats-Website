/**
 * GC-Stats — social-links
 *
 * V1 stores most `socials` platforms as a bare username, prefixing a fixed
 * base URL only at render time (same mapping shared by team/player/author/
 * publisher identity cards). V2 stores the full URL directly (validated as
 * a real link, see lib/organization-profile-validation.ts::isValidUrl).
 * 'discord', 'website', and 'email' already carry a full value in V1 and
 * pass through unchanged.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const USERNAME_BASE_URL: Record<string, string> = {
  twitter: "https://x.com/",
  twitch: "https://twitch.tv/",
  tiktok: "https://tiktok.com/@",
  instagram: "https://instagram.com/",
  youtube: "https://youtube.com/@",
};

/**
 * Converts a V1 `socials` JSON object (username-only for twitter/twitch/
 * tiktok/instagram/youtube) into V2's full-URL form. Leaves a value alone
 * if it already looks like a URL (already migrated, or entered by hand),
 * and drops empty/non-string values.
 */
export function convertSocials(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;
  for (const [platform, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const base = USERNAME_BASE_URL[platform];
    if (!base || /^https?:\/\//i.test(trimmed)) {
      result[platform] = trimmed;
      continue;
    }
    result[platform] = base + trimmed.replace(/^@/, "");
  }
  return result;
}

/**
 * GC-Stats - user-profile-validation
 *
 * Server side validation for the user profile edit form (name, username,
 * pronouns, bio, socials). Kept outside actions/user-profile.ts ("use
 * server"): a file with that directive can only export async functions,
 * never a plain const/type.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const USER_SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord"] as const;

// A social field must be a real link to that platform (mirrors the "team
// fan tag" precision request) — root domains only, subdomains allowed
// (e.g. m.twitch.tv), "www." stripped before comparison.
const SOCIAL_DOMAINS: Record<(typeof USER_SOCIAL_KEYS)[number], string[]> = {
  twitter: ["twitter.com", "x.com"],
  twitch: ["twitch.tv"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  discord: ["discord.gg", "discord.com"],
};

// Mirrors people.pronouns (smallint) — "" means unset (users.pronouns is nullable).
export const PRONOUN_OPTIONS = [0, 1, 2] as const;

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

// Anti-spam: no links allowed in the free-text bio (protocol links, "www.",
// or a bare domain-looking token) — the only links a profile may show are
// the dedicated, domain-checked social fields above.
const BIO_LINK_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|gg|io|co|me|tv|link|xyz|app|dev|fr|to|ru|info|biz)\b/i;

export type UserProfileFieldErrors = Partial<Record<string, string>>;

export type UserProfileInput = {
  name: string;
  username: string;
  pronouns: string; // "" | "0" | "1" | "2"
  bio: string;
  teamId: number | null;
  teamTag: string;
  socials: Partial<Record<(typeof USER_SOCIAL_KEYS)[number], string>>;
};

export type ValidatedUserProfile = {
  fieldErrors: UserProfileFieldErrors;
  name: string;
  username: string;
  pronouns: number | null;
  bio: string;
  socials: Record<string, string>;
};

function isValidSocialUrl(key: string, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const allowed = SOCIAL_DOMAINS[key as keyof typeof SOCIAL_DOMAINS] ?? [];
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Field-shape validation only. Left to the caller (needs a DB lookup each):
 * username-uniqueness, and the team fan pick (a team must exist and, when a
 * tag is given, it must be one of that team's own tags — mirrors V1's
 * ProfileSettingsController::updateFanTeam).
 */
export function validateUserProfileInput(input: UserProfileInput): ValidatedUserProfile {
  const fieldErrors: UserProfileFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  const username = input.username.trim();
  if (!username) fieldErrors.username = "required";
  else if (!USERNAME_RE.test(username)) fieldErrors.username = "invalid";

  let pronouns: number | null = null;
  if (input.pronouns) {
    const n = Number(input.pronouns);
    if (!(PRONOUN_OPTIONS as readonly number[]).includes(n)) fieldErrors.pronouns = "invalid";
    else pronouns = n;
  }

  const bio = input.bio.trim();
  if (bio.length > 2000) fieldErrors.bio = "tooLong";
  else if (BIO_LINK_RE.test(bio)) fieldErrors.bio = "noLinks";

  const socials: Record<string, string> = {};
  for (const key of USER_SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (!value) continue;
    if (!isValidSocialUrl(key, value)) {
      fieldErrors[`socials.${key}`] = "invalidDomain";
      continue;
    }
    socials[key] = value;
  }

  return { fieldErrors, name, username, pronouns, bio, socials };
}

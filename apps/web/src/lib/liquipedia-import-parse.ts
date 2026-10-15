/**
 * GC-Stats - liquipedia-import-parse
 *
 * Reads the infobox of a Liquipedia player or team page into the fields a
 * change request can carry. Pure, no DB access.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { extractTemplate, parseTemplateParams } from "@/lib/wikicode-import";
import { countryCodeFromEnglishName } from "@/lib/countries";

/** Socials a Liquipedia infobox can give us, in the order they are proposed. */
export const IMPORT_SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord"] as const;
export type ImportSocialKey = (typeof IMPORT_SOCIAL_KEYS)[number];

export type ParsedPlayerInfobox = {
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  /** One full URL per key, a person keeps a single account. */
  socials: Partial<Record<ImportSocialKey, string>>;
};

export type ParsedTeamInfobox = {
  countryCode: string | null;
  website: string | null;
  /** Every account found per key (`twitter`, `twitter2`, ...), in page order. */
  socials: Partial<Record<ImportSocialKey, string[]>>;
};

/** `https://liquipedia.net/valorant/Some_Page` for a canonical page title. */
export function liquipediaPageUrl(title: string): string {
  return `https://liquipedia.net/valorant/${encodeURI(title.replaceAll(" ", "_"))}`;
}

function clean(value: string | undefined): string {
  let sanitized = value ?? "";
  let previous: string;
  do {
    previous = sanitized;
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, "");
  } while (sanitized !== previous);
  return sanitized.trim();
}

/** Account handle from a bare handle or a pasted profile URL. */
function handleOf(value: string): string {
  const withoutQuery = value.split(/[?#]/)[0]!.replace(/\/+$/, "");
  const last = withoutQuery.split("/").pop() ?? "";
  return last.replace(/^@/, "").trim();
}

/** Full URL of a social account as written in an infobox, null when the value is unusable. */
export function socialUrl(key: ImportSocialKey, rawValue: string): string | null {
  const value = clean(rawValue);
  if (!value) return null;
  if (/^https?:\/\//i.test(value) && key !== "discord") return value;

  switch (key) {
    case "twitter": {
      const handle = handleOf(value);
      return handle ? `https://x.com/${handle}` : null;
    }
    case "twitch": {
      const handle = handleOf(value);
      return handle ? `https://www.twitch.tv/${handle}` : null;
    }
    case "instagram": {
      const handle = handleOf(value);
      return handle ? `https://www.instagram.com/${handle}` : null;
    }
    case "tiktok": {
      const handle = handleOf(value);
      return handle ? `https://www.tiktok.com/@${handle}` : null;
    }
    case "youtube": {
      if (/^(channel|c|user)\//i.test(value)) return `https://www.youtube.com/${value}`;
      const handle = handleOf(value);
      return handle ? `https://www.youtube.com/@${handle}` : null;
    }
    case "discord": {
      const code = handleOf(value);
      return /^[A-Za-z0-9-]{2,}$/.test(code) ? `https://discord.gg/${code}` : null;
    }
  }
}

/** The `name` of a player infobox as first and last name, split on the first space. */
function splitRealName(name: string): { firstName: string | null; lastName: string | null } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const space = trimmed.indexOf(" ");
  if (space === -1) return { firstName: trimmed, lastName: null };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() || null };
}

function countryOf(value: string | undefined): string | null {
  const cleaned = clean(value);
  return cleaned ? countryCodeFromEnglishName(cleaned) : null;
}

export function parsePlayerInfobox(wikitext: string): ParsedPlayerInfobox | null {
  const template = extractTemplate(wikitext, "Infobox player");
  if (!template) return null;
  const params = parseTemplateParams(template);

  const socials: ParsedPlayerInfobox["socials"] = {};
  // Discord on a person is a user id on our side, the infobox only has an invite code.
  for (const key of IMPORT_SOCIAL_KEYS.filter((k) => k !== "discord")) {
    const url = socialUrl(key, params[key] ?? "");
    if (url) socials[key] = url;
  }

  return { ...splitRealName(clean(params["name"])), countryCode: countryOf(params["country"]), socials };
}

export function parseTeamInfobox(wikitext: string): ParsedTeamInfobox | null {
  const template = extractTemplate(wikitext, "Infobox team");
  if (!template) return null;
  const params = parseTemplateParams(template);

  const socials: ParsedTeamInfobox["socials"] = {};
  for (const key of IMPORT_SOCIAL_KEYS) {
    const urls: string[] = [];
    for (const paramKey of [key, ...Array.from({ length: 9 }, (_, i) => `${key}${i + 2}`)]) {
      const url = socialUrl(key, params[paramKey] ?? "");
      if (url && !urls.includes(url)) urls.push(url);
    }
    if (urls.length > 0) socials[key] = urls;
  }

  const website = clean(params["website"]);
  return { countryCode: countryOf(params["location"]), website: /^https?:\/\//i.test(website) ? website : null, socials };
}

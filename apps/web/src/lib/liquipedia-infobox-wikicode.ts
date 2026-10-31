/**
 * GC-Stats - liquipedia-infobox-wikicode
 *
 * Builds a Liquipedia `{{Infobox league}}` block. Pure, no DB access.
 * Empty values are left out, except the essential ones GC Stats cannot know
 * (tier, images, type, ...), which carry a comment for the editor to complete.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type InfoboxInput = {
  name: string;
  organizer: string | null;
  startDate: string;
  endDate: string;
  /** Raw prize pool text such as "€35,000". */
  prizePool: string | null;
  /** Social handles by Liquipedia key (twitter, twitch, discord, youtube, ...). */
  socials: Record<string, string>;
  teamCount: number;
  maps: string[];
};

const CURRENCY_SYMBOLS: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP" };

function toComplete(hint?: string): string {
  return `<!-- To complete${hint ? `: ${hint}` : ""} -->`;
}

/** "€35,000" gives EUR / 35000, null when the text is not a plain amount. */
export function parsePrizePool(text: string | null): { currency: string; amount: string } | null {
  const match = text?.trim().match(/^([€$£])?\s*(\d[\d.,\s]*)\s*([A-Za-z]{3})?$/);
  if (!match) return null;
  const currency = match[1] ? CURRENCY_SYMBOLS[match[1]] : match[3]?.toUpperCase();
  const compact = match[2]!.replace(/\s/g, "");
  // "35.000" and "1.500,50" use the dot as thousands separator.
  const amount = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(compact) ? compact.replaceAll(".", "").replace(",", ".") : compact.replaceAll(",", "");
  return currency && /^\d+(\.\d+)?$/.test(amount) ? { currency, amount } : null;
}

/** Handle of a social URL: the last path segment (the whole path for YouTube channels). */
export function socialHandle(key: string, value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    if (key === "youtube") return segments.join("/");
    return segments[segments.length - 1] ?? "";
  } catch {
    return trimmed.replace(/^@/, "");
  }
}

export function buildInfoboxWikicode(input: InfoboxInput): string {
  const prize = parsePrizePool(input.prizePool);
  const fields: [string, string | null][] = [
    ["liquipediatier", toComplete("tier, for example C-Tier")],
    ["name", input.name],
    ["tickername", toComplete()],
    ["shortname", toComplete()],
    ["image", toComplete("file name")],
    ["imagedark", toComplete("file name")],
    ["icon", toComplete("file name")],
    ["series", toComplete()],
    ["organizer", input.organizer ?? toComplete()],
    ["type", toComplete("Online or Offline")],
    ["country", toComplete()],
    ["gc", "true"],
    ["sdate", input.startDate],
    ["edate", input.endDate],
    ["localcurrency", prize?.currency ?? toComplete("currency code")],
    ["prizepool", prize?.amount ?? toComplete("amount")],
    ...Object.entries(input.socials).map(([key, value]): [string, string | null] => [key, socialHandle(key, value)]),
    ["team_number", input.teamCount > 0 ? String(input.teamCount) : null],
    ...input.maps.map((map, index): [string, string | null] => [`map${index + 1}`, map]),
  ];
  return ["{{Infobox league", ...fields.filter(([, value]) => value).map(([key, value]) => `|${key}=${value}`), "}}"].join("\n");
}

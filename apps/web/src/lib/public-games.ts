/**
 * GC-Stats - public-games
 *
 * Which games visitors may see. `PUBLIC_GAMES` is a comma-separated list of game slugs read at runtime
 * (not a NEXT_PUBLIC_ variable), so launching a game is a changed variable and a restart. Unset or empty
 * means only the default game, so a production setup that forgets the variable stays safe. Pure and free
 * of `next/headers`, so the proxy can import it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { DEFAULT_GAME, isGameSlug, type GameSlug } from "@gc-stats/db/game";

const warned = new Set<string>();

/** Games parsed from a `PUBLIC_GAMES` value: trimmed, lower-cased, deduplicated, unknown slugs ignored. */
export function parsePublicGames(value: string | undefined): GameSlug[] {
  const games: GameSlug[] = [];
  for (const raw of (value ?? "").split(",")) {
    const slug = raw.trim().toLowerCase();
    if (!slug) continue;
    if (!isGameSlug(slug)) {
      if (!warned.has(slug)) {
        warned.add(slug);
        console.warn(`PUBLIC_GAMES: ignoring unknown game "${slug}"`);
      }
      continue;
    }
    if (!games.includes(slug)) games.push(slug);
  }
  return games.length > 0 ? games : [DEFAULT_GAME];
}

// The parse of the last value seen: it is read on hot paths (every request, every game of a list), and keyed on the
// raw string, so a changed variable is still picked up.
let lastRaw: string | undefined;
let lastParsed: readonly GameSlug[] | null = null;

/** The games visitors may see, from the `PUBLIC_GAMES` environment variable. Shared between calls, so not to be changed. */
export function publicGames(): readonly GameSlug[] {
  const raw = process.env.PUBLIC_GAMES;
  if (lastParsed === null || raw !== lastRaw) {
    lastParsed = parsePublicGames(raw);
    lastRaw = raw;
  }
  return lastParsed;
}

export function isGamePublic(game: GameSlug): boolean {
  return publicGames().includes(game);
}

/** An API version segment ("v1", "v2", ...). */
const API_VERSION_SEGMENT = /^v\d+$/;

/** True when the path asks for a game that is not public yet. Checks all segments before the api Version */
export function isHiddenGamePath(pathname: string): boolean {
  const segments = pathname.split("/").map(decodeSegment);
  const version = segments.findIndex((segment) => segment !== null && API_VERSION_SEGMENT.test(segment));
  const checked = version === -1 ? segments : segments.slice(0, version);
  return checked.some((segment) => segment !== null && isGameSlug(segment) && !isGamePublic(segment));
}

/** A path segment decoded, null when it can't be (a broken percent-encoding). */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** `preferred` when it is public, else the first public game (for redirects). */
export function fallbackPublicGame(preferred: GameSlug): GameSlug {
  const games = publicGames();
  return games.includes(preferred) ? preferred : games[0]!;
}

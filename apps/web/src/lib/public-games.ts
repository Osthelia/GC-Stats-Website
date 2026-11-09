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

/** The games visitors may see, from the `PUBLIC_GAMES` environment variable. */
export function publicGames(): GameSlug[] {
  return parsePublicGames(process.env.PUBLIC_GAMES);
}

export function isGamePublic(game: GameSlug): boolean {
  return publicGames().includes(game);
}

/** `preferred` when it is public, else the first public game (for redirects). */
export function fallbackPublicGame(preferred: GameSlug): GameSlug {
  const games = publicGames();
  return games.includes(preferred) ? preferred : games[0]!;
}

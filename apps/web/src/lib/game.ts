/**
 * GC-Stats - game
 *
 * Server helpers around the game route segment, plus the display names and
 * the cookie remembering the last visited game.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { DEFAULT_GAME, isGameSlug, type GameSlug } from "@gc-stats/db/game";

export const GAME_COOKIE = "gcs-game";

/** Game of the current route, 404 when the segment is not a known game. */
export async function gameFromParams(params: Promise<{ game: string }>): Promise<GameSlug> {
  const { game } = await params;
  if (!isGameSlug(game)) notFound();
  return game;
}

/** Last game the visitor browsed, falling back to the default one. */
export async function getPreferredGame(): Promise<GameSlug> {
  const value = (await cookies()).get(GAME_COOKIE)?.value;
  return isGameSlug(value) ? value : DEFAULT_GAME;
}

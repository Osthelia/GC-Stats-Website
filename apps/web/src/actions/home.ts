/**
 * GC-Stats - home
 *
 * Server action paginating the home page's upcoming match days list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { isGameSlug, type GameSlug } from "@gc-stats/db/game";
import { getHomeMatchPage, type HomeMatchChunk, type HomeMatchDirection } from "@/lib/home-data";

const EMPTY_PAGE: HomeMatchChunk = { matches: [], nextOffset: 0, hasMore: false };

export async function loadMoreHomeMatches(game: GameSlug, direction: HomeMatchDirection, offset: number): Promise<HomeMatchChunk> {
  if (!isGameSlug(game)) return EMPTY_PAGE;
  if (direction !== "past" && direction !== "future") return EMPTY_PAGE;
  if (!Number.isInteger(offset) || offset < 0) return EMPTY_PAGE;
  return getHomeMatchPage(game, direction, offset);
}

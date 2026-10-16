/**
 * GC-Stats - for-each-game
 *
 * Jobs act on the content of every game: run the per-game step on each one
 * and join the one-line summaries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { GAMES, type GameSlug } from "@gc-stats/db/game";

export async function forEachGame(step: (game: GameSlug) => Promise<string>): Promise<string> {
  const summaries: string[] = [];
  for (const game of GAMES) summaries.push(`${game}: ${await step(game)}`);
  return summaries.join(" | ");
}

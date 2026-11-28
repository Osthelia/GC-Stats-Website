/**
 * GC-Stats - for-each-game
 *
 * Jobs act on the content of every game: run the per-game step on each one
 * and join the one-line summaries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { GAMES, type GameSlug } from "@gc-stats/db/game";

/** A job summary reporting zero effective work (nothing activated/recorded), so the per-minute jobs don't flood logs with a line every tick. */
export function isNoopSummary(summary: string): boolean {
  return summary.startsWith("no ") || /^activated 0\//.test(summary) || /recorded\/updated 0 POV stream/.test(summary) || /^sent 0\//.test(summary);
}

/** Only the games that did something are kept, the result is itself a no-op summary when none did. */
export async function forEachGame(step: (game: GameSlug) => Promise<string>): Promise<string> {
  const summaries: string[] = [];
  for (const game of GAMES) {
    const summary = await step(game);
    if (!isNoopSummary(summary)) summaries.push(`${game}: ${summary}`);
  }
  return summaries.length > 0 ? summaries.join(" | ") : "no game had work to do";
}

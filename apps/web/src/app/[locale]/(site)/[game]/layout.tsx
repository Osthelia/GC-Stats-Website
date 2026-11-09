/**
 * GC-Stats - layout
 *
 * The game segment of the public pages: anything that is not a game is a 404, and the game is provided to the client components below.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { gameFromParams } from "@/lib/game";
import { GameScope } from "@/lib/use-game";

export default async function GameLayout({ children, params }: { children: React.ReactNode; params: Promise<{ game: string }> }) {
  const game = await gameFromParams(params);
  return <GameScope game={game}>{children}</GameScope>;
}

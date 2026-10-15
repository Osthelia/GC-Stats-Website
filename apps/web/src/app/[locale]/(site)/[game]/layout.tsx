/**
 * GC-Stats - layout
 *
 * The game segment of the public pages: anything that is not a game is a 404.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { gameFromParams } from "@/lib/game";

export default async function GameLayout({ children, params }: { children: React.ReactNode; params: Promise<{ game: string }> }) {
  await gameFromParams(params);
  return children;
}

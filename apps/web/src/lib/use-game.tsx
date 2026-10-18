"use client";

/**
 * GC-Stats - use-game
 *
 * Game of the current route for client components. Pages outside the
 * per-game routes (a global admin page showing the members of each game)
 * wrap their per-game parts in `GameScope`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { createContext, useContext, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { DEFAULT_GAME, isGameSlug, type GameSlug } from "@gc-stats/db/game";

const GameScopeContext = createContext<GameSlug | null>(null);

export function GameScope({ game, children }: { game: GameSlug; children: ReactNode }) {
  return <GameScopeContext.Provider value={game}>{children}</GameScopeContext.Provider>;
}

/** Game of the nearest `GameScope`, else of the current route, null outside the per-game pages. */
export function useRouteGame(): GameSlug | null {
  const scoped = useContext(GameScopeContext);
  const { game } = useParams<{ game?: string }>();
  return scoped ?? (isGameSlug(game) ? game : null);
}

export function useGame(): GameSlug {
  return useRouteGame() ?? DEFAULT_GAME;
}

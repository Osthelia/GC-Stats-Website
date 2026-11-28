"use client";

/**
 * GC-Stats - use-game
 *
 * Game of the current route for client components. Pages outside the
 * per-game routes (a global admin page showing the members of each game)
 * wrap their per-game parts in `GameScope`. The public pages without a game
 * (legal, about...) take the game the visitor browsed last, see `PreferredGameScope`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { DEFAULT_GAME, isGameSlug, type GameSlug } from "@gc-stats/db/game";

const GameScopeContext = createContext<GameSlug | null>(null);

export function GameScope({ game, children }: { game: GameSlug; children: ReactNode }) {
  return <GameScopeContext.Provider value={game}>{children}</GameScopeContext.Provider>;
}

export function PreferredGameScope({ game, viewableGames, children }: { game: GameSlug; viewableGames: readonly GameSlug[]; children: ReactNode }) {
  const { game: param } = useParams<{ game?: string }>();
  const routeGame = isGameSlug(param) ? param : null;
  const [lastGame, setLastGame] = useState(game);
  // Only a game the visitor can open: the 404 of a game that isn't public yet must not become the header's game.
  if (routeGame !== null && routeGame !== lastGame && viewableGames.includes(routeGame)) setLastGame(routeGame);
  // On a per-game page the route's own game counts (null here); the provider stays, so the header isn't mounted again.
  return <GameScopeContext.Provider value={routeGame === null ? lastGame : null}>{children}</GameScopeContext.Provider>;
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

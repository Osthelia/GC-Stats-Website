/**
 * GC-Stats — game module
 *
 * The games the site covers. Each one owns its own copy of the content
 * tables (`val_*`, `lol_*`, see schema/game-tables.ts) and its own URL
 * segment (`/valorant/...`, `/lol/...`). Kept free of any drizzle import so
 * client components can use it.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const GAMES = ["valorant", "lol"] as const;

export type GameSlug = (typeof GAMES)[number];

export const DEFAULT_GAME: GameSlug = "valorant";

// seriesUnit names what a match is made of in the UI: a Valorant "Map", a LoL "Game". It is
// the translation key segment for those labels (`field{seriesUnit}WinPoints`), so it stays English.
export const GAME_INFO: Record<GameSlug, { slug: GameSlug; name: string; shortName: string; tablePrefix: "val" | "lol"; liquipediaWiki: string; seriesUnit: "Map" | "Game" }> = {
  valorant: { slug: "valorant", name: "VALORANT", shortName: "VAL", tablePrefix: "val", liquipediaWiki: "valorant", seriesUnit: "Map" },
  lol: { slug: "lol", name: "League of Legends", shortName: "LoL", tablePrefix: "lol", liquipediaWiki: "leagueoflegends", seriesUnit: "Game" },
};

export function isGameSlug(value: unknown): value is GameSlug {
  return typeof value === "string" && (GAMES as readonly string[]).includes(value);
}

// Features only some games have (LoL has no maps/stats nor veto).
export function gameHasMaps(game: GameSlug): boolean {
  return game === "valorant";
}

// Match wikicode and the match import rely on maps, so they stay Valorant only for now.
export function gameHasLiquipediaMatches(game: GameSlug): boolean {
  return game === "valorant";
}

// VLR.gg only covers Valorant.
export function gameHasVlr(game: GameSlug): boolean {
  return game === "valorant";
}

export function gameHasVeto(game: GameSlug): boolean {
  return game === "valorant";
}

export function gameHasStats(game: GameSlug): boolean {
  return gameHasMaps(game) || gameHasSeriesGames(game);
}

// A series is made of games stored in their own table (`lol_games`), not of maps.
export function gameHasSeriesGames(game: GameSlug): boolean {
  return game === "lol";
}

// Roster entries carry lanes (Top to Support) in League of Legends.
export function gameHasLanes(game: GameSlug): boolean {
  return game === "lol";
}

// An in-game leader is a Valorant role, League rosters have none.
export function gameHasIgl(game: GameSlug): boolean {
  return game === "valorant";
}

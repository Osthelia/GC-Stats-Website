/**
 * GC-Stats — game module
 *
 * The games the site covers. Each one owns its own copy of the content
 * tables (`val_*`, `lol_*`, see schema/game-tables.ts) and its own URL
 * segment (`/valorant/...`, `/lol/...`). Kept free of any drizzle import so
 * client components can use it.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const GAMES = ["valorant", "lol"] as const;

export type GameSlug = (typeof GAMES)[number];

export const DEFAULT_GAME: GameSlug = "valorant";

export const GAME_INFO: Record<GameSlug, { slug: GameSlug; name: string; shortName: string; tablePrefix: "val" | "lol"; liquipediaWiki: string }> = {
  valorant: { slug: "valorant", name: "VALORANT", shortName: "VAL", tablePrefix: "val", liquipediaWiki: "valorant" },
  lol: { slug: "lol", name: "League of Legends", shortName: "LoL", tablePrefix: "lol", liquipediaWiki: "leagueoflegends" },
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

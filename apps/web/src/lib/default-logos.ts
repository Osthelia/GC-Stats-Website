/**
 * GC-Stats - default-logos
 *
 * Fallback logos used when an entity has no logo of its own.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import type { GameSlug } from "@gc-stats/db/game";

export const DEFAULT_TOURNAMENT_LOGO = "/logos/tournaments/default.webp";
export const DEFAULT_LOL_TOURNAMENT_LOGO = "/logos/tournaments/default-lol.webp";
export const DEFAULT_TEAM_LOGO_DARK = "/logos/teams/default-dark.webp";
export const DEFAULT_TEAM_LOGO_LIGHT = "/logos/teams/default-light.webp";


export function defaultTournamentLogo(game: GameSlug): string {
  return game === "lol" ? DEFAULT_LOL_TOURNAMENT_LOGO : DEFAULT_TOURNAMENT_LOGO;
}

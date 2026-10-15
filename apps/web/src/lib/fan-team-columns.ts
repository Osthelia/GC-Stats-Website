/**
 * GC-Stats - fan-team-columns
 *
 * Columns of `users` holding the "fan of" team of each game. They are real
 * columns kept out of the Drizzle schema (see schema/auth.ts), so they are
 * read and written with raw SQL through these identifiers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { GameSlug } from "@gc-stats/db/game";

export const FAN_TEAM_COLUMNS: Record<GameSlug, { team: string; tag: string }> = {
  valorant: { team: "team_id", tag: "team_tag" },
  lol: { team: "lol_team_id", tag: "lol_team_tag" },
};

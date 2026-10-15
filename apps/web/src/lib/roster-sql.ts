/**
 * GC-Stats - roster-sql
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { gameTables } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";

export function rosterPeriodIsDated(game: GameSlug) {
  const { rosterMemberships } = gameTables(game);
  return sql`NOT (${rosterMemberships.hasLeft} AND upper_inf(${rosterMemberships.period}))`;
}

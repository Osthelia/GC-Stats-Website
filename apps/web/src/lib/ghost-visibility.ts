/**
 * GC-Stats - ghost-visibility
 *
 * Ghost profiles (teams, people, tournaments flagged `is_ghost`) exist only
 * to hold a GC team's match played in an uncovered mix tournament. They are
 * rendered on that match and nowhere else: no page, no search, no listing.
 * Every public query filters through these clauses.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { gameTables } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";

/** Which rows a picker returns: public ones, ghosts only, or both. */
export type GhostScope = "exclude" | "only" | "include";

export function visibleTeam(game: GameSlug) {
  const { teams } = gameTables(game);
  return eq(teams.isGhost, false);
}
export function visiblePerson(game: GameSlug) {
  const { people } = gameTables(game);
  return eq(people.isGhost, false);
}
export function visibleTournament(game: GameSlug) {
  const { tournaments } = gameTables(game);
  return eq(tournaments.isGhost, false);
}

export function visibleMatch(game: GameSlug) {
  const { matches } = gameTables(game);
  return sql`not exists (
  select 1 from ${gameTables(game).stageContainers} gsc
  join ${gameTables(game).stages} gs on gs.id = gsc.stage_id
  join ${gameTables(game).tournaments} gt on gt.id = gs.tournament_id
  where gsc.id = ${matches.containerId} and gt.is_ghost
)`;
}

export function ghostScopeClause(isGhostColumn: PgColumn, scope: GhostScope): SQL | undefined {
  if (scope === "include") return undefined;
  return eq(isGhostColumn, scope === "only");
}

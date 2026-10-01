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
import { teams, people, tournaments, matches } from "@gc-stats/db";

/** Which rows a picker returns: public ones, ghosts only, or both. */
export type GhostScope = "exclude" | "only" | "include";

export const visibleTeam = eq(teams.isGhost, false);
export const visiblePerson = eq(people.isGhost, false);
export const visibleTournament = eq(tournaments.isGhost, false);

/** For queries on `matches` that don't join the tournament: excludes matches of a ghost tournament. */
export const visibleMatch = sql`not exists (
  select 1 from stage_containers gsc
  join stages gs on gs.id = gsc.stage_id
  join tournaments gt on gt.id = gs.tournament_id
  where gsc.id = ${matches.containerId} and gt.is_ghost
)`;

export function ghostScopeClause(isGhostColumn: PgColumn, scope: GhostScope): SQL | undefined {
  if (scope === "include") return undefined;
  return eq(isGhostColumn, scope === "only");
}

/**
 * GC-Stats - entrant-teams
 *
 * Resolves entrant ids to their team id, shared by the matches/map v1
 * endpoints that expose team_id at player or round granularity.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { entrants } from "@gc-stats/db";

/** Resolves entrant ids to their team id (a bye/TBD entrant has none) — shared by the matches/map endpoints that expose team_id at player/round granularity. */
export async function resolveEntrantTeamIds(entrantIds: number[]): Promise<Map<number, number | null>> {
  if (entrantIds.length === 0) return new Map();
  const rows = await db
    .select({ id: entrants.id, teamId: entrants.teamId })
    .from(entrants)
    .where(inArray(entrants.id, entrantIds));
  return new Map(rows.map((r) => [r.id, r.teamId]));
}

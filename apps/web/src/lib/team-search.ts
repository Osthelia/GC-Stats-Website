/**
 * GC-Stats - team-search
 *
 * Typo-tolerant team search backing TeamPicker, shared by admin and
 * dashboard so both call the same query under their own permission gate,
 * same split as person-search.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { teams } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import { ghostScopeClause, type GhostScope } from "@/lib/ghost-visibility";

export type TeamPickerResult = { id: number; name: string; countryCode: string | null };

/**
 * Typo-tolerant team search backing TeamPicker — numeric input matches
 * id/VLR id exactly, text matches name/short name via the same accent/typo
 * folding as the admin list pages. Pulled out of actions/admin-players.ts
 * (searchTeams) so both /admin and /dashboard can call the same query
 * function under their own permission gate, same split as person-search.ts.
 *
 * `excludeId` drops one team from the results (the team merge target picker
 * uses this to hide the source team itself) without needing a separate query
 * function. `ghosts` picks public teams, ghost teams or both.
 */
export async function searchTeamsQuery(query: string, excludeId?: number, ghosts: GhostScope = "exclude"): Promise<TeamPickerResult[]> {
  const q = query.trim();
  const excludeClause = and(excludeId !== undefined ? ne(teams.id, excludeId) : undefined, ghostScopeClause(teams.isGhost, ghosts));

  if (!q) {
    return db
      .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
      .from(teams)
      .where(excludeClause)
      .orderBy(teams.name)
      .limit(8);
  }

  const numeric = /^\d+$/.test(q);
  const variants = typoVariants(q.toLowerCase());
  const clauses = variants.flatMap((v) => [foldedIlike(teams.name, v), foldedIlike(teams.shortName, v)]);
  if (numeric) {
    const n = Number(q);
    clauses.push(eq(teams.id, n), eq(teams.vlrId, n));
  }

  return db
    .select({ id: teams.id, name: teams.name, countryCode: teams.countryCode })
    .from(teams)
    .where(and(or(...clauses), excludeClause))
    .orderBy(teams.name)
    .limit(8);
}

/**
 * GC-Stats - person-search
 *
 * Typo-tolerant people search backing PersonPicker, shared by admin and
 * dashboard forms so there's a single search implementation to maintain.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { people } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import { ghostScopeClause, type GhostScope } from "@/lib/ghost-visibility";

export type PersonPickerResult = { id: number; handle: string; countryCode: string | null };

/**
 * Typo-tolerant people search backing PersonPicker — mirrors V1's
 * entity-picker search: numeric input matches id/VLR ID exactly, text
 * matches handle via the same accent/typo folding as the admin list pages.
 * Pulled out of actions/admin-players.ts (searchPeople) so it's a plain
 * function other server actions can call directly, same split as
 * lib/user-search.ts for accounts.
 *
 * `excludeId` drops one person from the results (the player merge target
 * picker uses this to hide the source player itself) without needing a
 * separate query function.
 *
 * `restrictToPersonIds` narrows the whole search to a fixed set of people
 * (e.g. an organization's own members) instead of the entire `people` table
 * — an empty array means "nobody", not "unrestricted", so it short-circuits.
 *
 * `ghosts` picks public people, ghost people or both.
 */
export async function searchPeopleQuery(query: string, excludeId?: number, restrictToPersonIds?: number[], ghosts: GhostScope = "exclude"): Promise<PersonPickerResult[]> {
  if (restrictToPersonIds && restrictToPersonIds.length === 0) return [];

  const q = query.trim();
  const excludeClause = excludeId !== undefined ? ne(people.id, excludeId) : undefined;
  const restrictClause = restrictToPersonIds ? inArray(people.id, restrictToPersonIds) : undefined;
  const baseClauses = [excludeClause, restrictClause, ghostScopeClause(people.isGhost, ghosts)].filter((c) => c !== undefined);

  if (!q) {
    return db
      .select({ id: people.id, handle: people.handle, countryCode: people.countryCode })
      .from(people)
      .where(baseClauses.length ? and(...baseClauses) : undefined)
      .orderBy(people.handle)
      .limit(8);
  }

  const numeric = /^\d+$/.test(q);
  const variants = typoVariants(q.toLowerCase());
  const clauses = variants.map((v) => foldedIlike(people.handle, v));
  if (numeric) {
    const n = Number(q);
    clauses.push(eq(people.id, n), eq(people.vlrId, n));
  }

  return db
    .select({ id: people.id, handle: people.handle, countryCode: people.countryCode })
    .from(people)
    .where(and(or(...clauses), ...baseClauses))
    .orderBy(people.handle)
    .limit(8);
}

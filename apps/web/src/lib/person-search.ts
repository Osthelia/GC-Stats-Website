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

import { and, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { gameTables, sharedPeople } from "@gc-stats/db";
import { typoVariants, stripSpecialChars } from "@/lib/search-typo";
import { specialCharFoldedIlike, specialCharPrefixRank } from "@/lib/db-search";
import { scoreMatch } from "@/lib/search";
import { ghostScopeClause, type GhostScope } from "@/lib/ghost-visibility";
import type { GameSlug } from "@gc-stats/db/game";

export type PersonPickerResult = { id: number; handle: string; countryCode: string | null; secondaryCountryCode: string | null; inGame?: boolean };

/** Where a search looks: the people of the game, or every person (the ones outside the game are flagged `inGame: false`). */
export type PersonSearchScope = "game" | "all";

function columns(game: GameSlug) {
  const { people } = gameTables(game);
  return { id: people.id, handle: people.handle, countryCode: people.countryCode, secondaryCountryCode: people.secondaryCountryCode };
}

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
 *
 * `scope` "all" also finds people who have no profile in this game yet, to add them to it.
 */
export async function searchPeopleQuery(game: GameSlug, query: string, excludeId?: number, restrictToPersonIds?: number[], ghosts: GhostScope = "exclude", scope: PersonSearchScope = "game"): Promise<PersonPickerResult[]> {
  const { people, personProfiles } = gameTables(game);
  if (restrictToPersonIds && restrictToPersonIds.length === 0) return [];

  // "all" searches every identity and flags the ones not in this game yet, "game" only the people of this game.
  const all = scope === "all";
  const idColumn = all ? sharedPeople.id : people.id;
  const handleColumn = all ? sharedPeople.handle : people.handle;
  const ghostColumn = all ? sql`coalesce(${personProfiles.isGhost}, false)` : people.isGhost;
  const vlrColumn = all ? (game === "valorant" ? personProfiles.vlrId : null) : people.vlrId;

  const q = query.trim();
  const excludeClause = excludeId !== undefined ? ne(idColumn, excludeId) : undefined;
  const restrictClause = restrictToPersonIds ? inArray(idColumn, restrictToPersonIds) : undefined;
  const baseClauses = [excludeClause, restrictClause, ghostScopeClause(ghostColumn, ghosts)].filter((c) => c !== undefined);

  const run = (where: SQL | undefined, order: SQL | PgColumn, limit: number): Promise<PersonPickerResult[]> => {
    if (!all) return db.select(columns(game)).from(people).where(where).orderBy(order).limit(limit);
    return db
      .select({ id: sharedPeople.id, handle: sharedPeople.handle, countryCode: sharedPeople.countryCode, secondaryCountryCode: sharedPeople.secondaryCountryCode, inGame: sql<boolean>`${personProfiles.personId} is not null` })
      .from(sharedPeople)
      .leftJoin(personProfiles, eq(personProfiles.personId, sharedPeople.id))
      .where(where)
      .orderBy(order)
      .limit(limit);
  };

  if (!q) return run(baseClauses.length ? and(...baseClauses) : undefined, handleColumn, 8);

  const numeric = /^\d+$/.test(q);
  const variants = [...new Set(typoVariants(q.toLowerCase()).map(stripSpecialChars))].filter((v) => v.length > 0);
  const clauses = variants.map((v) => specialCharFoldedIlike(handleColumn, v));
  if (numeric) {
    const n = Number(q);
    clauses.push(eq(idColumn, n));
    if (vlrColumn) clauses.push(eq(vlrColumn, n));
  }
  if (clauses.length === 0) return [];
  const base = variants[0] ?? q.toLowerCase();

  // Same matching and scoring as the public search, over a wider candidate pool re-ranked in memory.
  const rows = await run(and(or(...clauses), ...baseClauses), specialCharPrefixRank(handleColumn, base), 30);

  return rows
    .map((row) => ({ row, score: scoreMatch(row.handle, base, base.length, 0) + (numeric && row.id === Number(q) ? 5000 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ row }) => row);
}

/**
 * GC-Stats - db-search
 *
 * Accent-folded, case-insensitive substring matching helpers built on
 * Postgres `translate()`, used by admin lists and the global search.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql, getTableName } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { PgTable } from "drizzle-orm/pg-core";

// Equal-length translate() maps — accent char -> its plain ASCII equivalent.
// No pgcrypto/unaccent extension dependency: translate() is built-in.
const ACCENT_SRC = "àâäáãåèêëéìîïíòôöóõøùûüúýÿçñ";
const ACCENT_DST = "aaaaaaeeeeiiiiooooooouuuuyycn";

// LIKE treats %, _ and \ as special — escape them so a search term containing
// one of those characters matches it literally instead of as a wildcard.
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Accent-folded, case-insensitive substring match — lets a search for
 * "Zennit" find a row stored as "Zénnit". `pattern` must already be
 * lowercased/accent-stripped (see lib/search-typo.ts::typoVariants).
 */
export function foldedIlike(column: AnyPgColumn, pattern: string) {
  return sql`translate(lower(${column}), ${ACCENT_SRC}, ${ACCENT_DST}) LIKE ${`%${escapeLikePattern(pattern)}%`}`;
}

/**
 * Same accent-folding as `foldedIlike`, plus punctuation/spacing dropped from
 * the column value — lets a search for "remake" find "Re//make" or "g2gozen"
 * find "G2 Gozen". `pattern` must already be lowercased/accent-stripped and
 * special-char-stripped (see lib/search-typo.ts::stripSpecialChars) so both
 * sides of the LIKE are normalized the same way. Used by the global search
 * (lib/search.ts) — not swapped in for `foldedIlike`'s existing admin-list
 * callers, which don't need this and whose behavior shouldn't shift here.
 */
export function specialCharFoldedIlike(column: AnyPgColumn, pattern: string) {
  return sql`regexp_replace(translate(lower(${column}), ${ACCENT_SRC}, ${ACCENT_DST}), '[^a-z0-9]', '', 'g') LIKE ${`%${escapeLikePattern(pattern)}%`}`;
}

/**
 * Ranking expression for ORDER BY — 0 for an exact prefix match, 1 for a
 * substring match elsewhere, 2 otherwise. Mirrors V1's App\Services\
 * SearchService::search() `$prefixFirst` closure: candidates are ranked this
 * way and LIMITed *before* scoring, so the most relevant rows are never
 * pushed out of the candidate pool by an arbitrary DB row order when a
 * search term has far more than `candidateLimit` matches.
 */
export function specialCharPrefixRank(column: AnyPgColumn, pattern: string) {
  const folded = sql`regexp_replace(translate(lower(${column}), ${ACCENT_SRC}, ${ACCENT_DST}), '[^a-z0-9]', '', 'g')`;
  const escaped = escapeLikePattern(pattern);
  return sql`CASE WHEN ${folded} LIKE ${`${escaped}%`} THEN 0 WHEN ${folded} LIKE ${`%${escaped}%`} THEN 1 ELSE 2 END`;
}

/**
 * A `"table"."column"` reference, always table-qualified. Needed instead of
 * a plain column reference (e.g. `${teams.id}`) inside a correlated
 * subquery's raw SQL: when the outer query's FROM is a single unaliased
 * table, drizzle renders that column bare (no table prefix) even inside the
 * subquery — which then collides with a same-named column on the
 * subquery's own FROM table (e.g. both `teams` and `roster_memberships`
 * have an `id` column), producing a real "ambiguous column" error from
 * Postgres, not just a cosmetic one.
 */
export function qualifiedColumn(table: PgTable, columnName: string) {
  return sql.raw(`"${getTableName(table)}"."${columnName}"`);
}

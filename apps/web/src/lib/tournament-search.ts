/**
 * GC-Stats - tournament-search
 *
 * Typo-tolerant tournament search, same shape as team-search.ts/
 * person-search.ts, backing the news article relations picker (dashboard)
 * and any future admin tournament picker.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike, foldedArrayIlike } from "@/lib/db-search";
import { visibleTournament } from "@/lib/ghost-visibility";

export type TournamentPickerResult = { id: number; name: string };

/** Typo-tolerant tournament search — same shape as team-search.ts/person-search.ts, backing the news article relations picker (dashboard) and any future admin tournament picker. */
export async function searchTournamentsQuery(query: string, opts: { onlyTournamentIds?: number[] } = {}): Promise<TournamentPickerResult[]> {
  const q = query.trim();
  const scope = opts.onlyTournamentIds ? inArray(tournaments.id, opts.onlyTournamentIds.length > 0 ? opts.onlyTournamentIds : [-1]) : undefined;
  if (!q) {
    return db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(and(visibleTournament, scope)).orderBy(tournaments.name).limit(8);
  }

  const numeric = /^\d+$/.test(q);
  const variants = typoVariants(q.toLowerCase());
  const clauses = variants.flatMap((v) => [foldedIlike(tournaments.name, v), foldedArrayIlike(tournaments.keywords, v)]);
  if (numeric) clauses.push(eq(tournaments.id, Number(q)));

  return db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(and(visibleTournament, scope, or(...clauses)))
    .orderBy(tournaments.name)
    .limit(8);
}

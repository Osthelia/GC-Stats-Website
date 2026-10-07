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

import { and, eq, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { tournaments } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike, foldedArrayIlike } from "@/lib/db-search";
import { visibleTournament } from "@/lib/ghost-visibility";

export type TournamentPickerResult = { id: number; name: string };

/** Typo-tolerant tournament search — same shape as team-search.ts/person-search.ts, backing the news article relations picker (dashboard) and any future admin tournament picker. */
export async function searchTournamentsQuery(query: string): Promise<TournamentPickerResult[]> {
  const q = query.trim();
  if (!q) {
    return db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(visibleTournament).orderBy(tournaments.name).limit(8);
  }

  const numeric = /^\d+$/.test(q);
  const variants = typoVariants(q.toLowerCase());
  const clauses = variants.flatMap((v) => [foldedIlike(tournaments.name, v), foldedArrayIlike(tournaments.keywords, v)]);
  if (numeric) clauses.push(eq(tournaments.id, Number(q)));

  return db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(and(visibleTournament, or(...clauses)))
    .orderBy(tournaments.name)
    .limit(8);
}

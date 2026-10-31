/**
 * GC-Stats - liquipedia-talent-data
 *
 * Loads the production credits of a tournament and builds its Liquipedia
 * Talent wikicode.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";
import { buildTalentWikicode } from "@/lib/liquipedia-broadcast-export";

export type LiquipediaTalentWikicode = { wikicode: string; creditCount: number; unlinkedPeopleCount: number };

export async function getTournamentTalentWikicode(game: GameSlug, tournamentId: number): Promise<LiquipediaTalentWikicode> {
  const { liquipediaPersonNames, people, productionCredits } = gameTables(game);
  const rows = await db
    .select({ personId: people.id, handle: people.handle, liquipediaName: liquipediaPersonNames.name, role: productionCredits.role, title: productionCredits.titleOverride })
    .from(productionCredits)
    .innerJoin(people, eq(people.id, productionCredits.personId))
    .leftJoin(liquipediaPersonNames, eq(liquipediaPersonNames.personId, people.id))
    .where(eq(productionCredits.tournamentId, tournamentId))
    .orderBy(asc(productionCredits.id));

  return {
    wikicode: rows.length > 0 ? buildTalentWikicode(rows) : "",
    creditCount: rows.length,
    unlinkedPeopleCount: new Set(rows.filter((r) => !r.liquipediaName).map((r) => r.personId)).size,
  };
}

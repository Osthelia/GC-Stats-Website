/**
 * GC-Stats - admin-player-duplicates
 *
 * Finds people who are probably the same human recorded twice, once per game: same handle, and
 * no game where both have a profile. Feeds the duplicates page and the merge page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, lt, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { adminDb as db } from "@gc-stats/db/client";
import { sharedPeople, gameTables } from "@gc-stats/db";
import { GAMES, type GameSlug } from "@gc-stats/db/game";

export type DuplicateSide = {
  id: number;
  handle: string;
  countryCode: string | null;
  secondaryCountryCode: string | null;
  games: GameSlug[];
};

/** `source` has a profile in the game being browsed and would be merged into `target`. */
export type DuplicatePair = { source: DuplicateSide; target: DuplicateSide };

const MAX_DUPLICATES = 200;

/** A person's identity, for the merge target picked from a link. */
export async function getPersonSummary(personId: number): Promise<{ id: number; handle: string; countryCode: string | null; secondaryCountryCode: string | null } | null> {
  const [person] = await db
    .select({ id: sharedPeople.id, handle: sharedPeople.handle, countryCode: sharedPeople.countryCode, secondaryCountryCode: sharedPeople.secondaryCountryCode })
    .from(sharedPeople)
    .where(eq(sharedPeople.id, personId))
    .limit(1);
  return person ?? null;
}

/** Pairs with the same handle where exactly one side exists in `game`, the other one lives in another game only. */
export async function listPlayerDuplicates(game: GameSlug): Promise<DuplicatePair[]> {
  const a = alias(sharedPeople, "dup_a");
  const b = alias(sharedPeople, "dup_b");

  const inGame = (g: GameSlug, id: SQL) => sql<boolean>`exists (select 1 from ${gameTables(g).personProfiles} gp where gp.person_id = ${id})`;
  const flags = (side: { id: AnyPgColumn }) => Object.fromEntries(GAMES.map((g) => [g, inGame(g, sql`${side.id}`)])) as Record<GameSlug, SQL<boolean>>;
  const aGames = flags(a);
  const bGames = flags(b);

  const disjointGames = GAMES.map((g) => sql`not (${aGames[g]} and ${bGames[g]})`);

  const rows = await db
    .select({
      aId: a.id,
      aHandle: a.handle,
      aCountry: a.countryCode,
      aSecondary: a.secondaryCountryCode,
      bId: b.id,
      bHandle: b.handle,
      bCountry: b.countryCode,
      bSecondary: b.secondaryCountryCode,
      aValorant: aGames.valorant,
      aLol: aGames.lol,
      bValorant: bGames.valorant,
      bLol: bGames.lol,
    })
    .from(a)
    .innerJoin(b, and(sql`lower(${a.handle}) = lower(${b.handle})`, lt(a.id, b.id)))
    .where(and(...disjointGames, sql`${aGames[game]} <> ${bGames[game]}`))
    .orderBy(sql`lower(${a.handle})`, a.id)
    .limit(MAX_DUPLICATES);

  return rows.map((r) => {
    const sideA: DuplicateSide = { id: r.aId, handle: r.aHandle, countryCode: r.aCountry, secondaryCountryCode: r.aSecondary, games: GAMES.filter((g) => (g === "valorant" ? r.aValorant : r.aLol)) };
    const sideB: DuplicateSide = { id: r.bId, handle: r.bHandle, countryCode: r.bCountry, secondaryCountryCode: r.bSecondary, games: GAMES.filter((g) => (g === "valorant" ? r.bValorant : r.bLol)) };
    return sideA.games.includes(game) ? { source: sideA, target: sideB } : { source: sideB, target: sideA };
  });
}

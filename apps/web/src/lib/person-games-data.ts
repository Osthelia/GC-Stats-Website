/**
 * GC-Stats - person-games-data
 *
 * Which games a person has a profile in. A person is one identity shared by every game, a game
 * lists it only once it has a profile there.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { sharedPeople, gameTables } from "@gc-stats/db";
import { GAMES, type GameSlug } from "@gc-stats/db/game";
import { redirect } from "@/i18n/navigation";
import { slugify } from "@/lib/entity-id";
import { withGame } from "@/lib/game-href";

export type PersonGames = { handle: string; games: GameSlug[] };

/** The identity's handle and the games it has a profile in, null when the person does not exist. */
export const getPersonGames = cache(async (personId: number): Promise<PersonGames | null> => {
  const [person] = await db.select({ handle: sharedPeople.handle }).from(sharedPeople).where(eq(sharedPeople.id, personId)).limit(1);
  if (!person) return null;

  const games: GameSlug[] = [];
  for (const game of GAMES) {
    const { personProfiles } = gameTables(game);
    const [profile] = await db.select({ id: personProfiles.personId }).from(personProfiles).where(eq(personProfiles.personId, personId)).limit(1);
    if (profile) games.push(game);
  }
  return { handle: person.handle, games };
});

/** A player page of a game where the person has no profile: sent to the game that has one, 404 when none does. */
export async function playerNotInGame(game: GameSlug, personId: number): Promise<never> {
  const person = await getPersonGames(personId);
  const elsewhere = person?.games.find((g) => g !== game);
  if (!person || !elsewhere) notFound();
  redirect({ href: withGame(`/player/${personId}/${slugify(person.handle)}`, elsewhere), locale: await getLocale() });
  throw new Error("unreachable");
}

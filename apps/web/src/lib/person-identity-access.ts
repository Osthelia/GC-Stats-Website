/**
 * GC-Stats - person-identity-access
 *
 * Who may change what every game shares about a person (identity, socials, photo, linked account).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getGlobalAccess, hasAccess } from "@/lib/rbac";
import { getPersonGames } from "@/lib/person-games-data";

/** True when the user holds `permission` in one of the person's games, or when the person has no profile at all. */
export async function managesAGameOfPerson(userId: string, personId: number, permission: string): Promise<boolean> {
  const games = (await getPersonGames(personId))?.games ?? [];
  for (const game of games) {
    if (hasAccess(await getGlobalAccess(userId, game), permission)) return true;
  }
  return games.length === 0;
}

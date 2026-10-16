/**
 * GC-Stats - person-games
 *
 * Lets a signed in user add a game to their own person: one identity, one profile per game.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { sharedPeople, gameTables } from "@gc-stats/db";
import { GAMES, isGameSlug, type GameSlug } from "@gc-stats/db/game";
import { getCurrentUserId } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";

/** Games the person has no profile in, only answered to the account linked to that person. */
export async function getMyMissingGameProfiles(personId: number): Promise<GameSlug[]> {
  const userId = await getCurrentUserId();
  if (!userId || !Number.isInteger(personId) || personId <= 0) return [];

  const [owned] = await db.select({ id: sharedPeople.id }).from(sharedPeople).where(and(eq(sharedPeople.id, personId), eq(sharedPeople.userId, userId))).limit(1);
  if (!owned) return [];

  const missing: GameSlug[] = [];
  for (const game of GAMES) {
    const { personProfiles } = gameTables(game);
    const [profile] = await db.select({ id: personProfiles.personId }).from(personProfiles).where(eq(personProfiles.personId, personId)).limit(1);
    if (!profile) missing.push(game);
  }
  return missing;
}

export type AddGameProfileResult = { ok: true } | { ok: false; error: "unauthenticated" | "notYours" | "invalidGame" | "alreadyThere" };

/** Creates the profile of `game` on the person linked to the signed in account, no review needed since the identity is already theirs. */
export async function addMyGameProfile(game: string, personId: number): Promise<AddGameProfileResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "unauthenticated" };
  if (!isGameSlug(game)) return { ok: false, error: "invalidGame" };

  const [owned] = await db.select({ id: sharedPeople.id, handle: sharedPeople.handle }).from(sharedPeople).where(and(eq(sharedPeople.id, personId), eq(sharedPeople.userId, userId))).limit(1);
  if (!owned) return { ok: false, error: "notYours" };

  const { personProfiles } = gameTables(game);
  const created = await db.insert(personProfiles).values({ personId }).onConflictDoNothing().returning({ id: personProfiles.personId });
  if (created.length === 0) return { ok: false, error: "alreadyThere" };

  await logActivity({ game, subject: "player", subjectId: personId, event: "updated", description: `Added the ${game} profile of player #${personId} (${owned.handle})`, actorUserId: userId });
  return { ok: true };
}

/**
 * GC-Stats - person-service
 *
 * Writes of a person. The identity (handle, name, country, bio, socials, linked account) is
 * shared by every game, the profile (active/ghost flags, Liquipedia page, Riot ids) belongs to
 * one game. A person exists in a game once it has a profile there, `ensureGameProfile` gives it
 * one. Reads go through the `people` views of `gameTables(game)`, they are read only.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, or } from "drizzle-orm";
import type { adminDb } from "@gc-stats/db/client";
import { sharedPeople, gameTables, valorantTablesOf } from "@gc-stats/db";
import { GAMES, type GameSlug } from "@gc-stats/db/game";

/** The client or transaction a write runs on. */
export type PersonWriteClient = Pick<typeof adminDb, "select" | "insert" | "update" | "delete">;

export type PersonIdentityValues = Partial<typeof sharedPeople.$inferInsert>;

type ProfileValues = Partial<Omit<ReturnType<typeof gameTables>["personProfiles"]["$inferInsert"], "personId">>;

/** Riot and VLR ids exist on the Valorant profile only, other games never get them. */
const RIOT_KEYS = ["valId", "esportsValId", "vlrId"] as const;

function profileValuesOf(game: GameSlug, values: ProfileValues): ProfileValues {
  if (game === "valorant") return values;
  const copy = { ...values };
  for (const key of RIOT_KEYS) delete copy[key];
  return copy;
}

/** Gives the person a profile in this game when it has none yet. */
export async function ensureGameProfile(client: PersonWriteClient, game: GameSlug, personId: number): Promise<void> {
  const { personProfiles } = gameTables(game);
  await client.insert(personProfiles).values({ personId }).onConflictDoNothing();
}

/** Same as `ensureGameProfile` for several people at once. */
export async function ensureGameProfiles(client: PersonWriteClient, game: GameSlug, personIds: number[]): Promise<void> {
  const unique = [...new Set(personIds)];
  if (unique.length === 0) return;
  const { personProfiles } = gameTables(game);
  await client.insert(personProfiles).values(unique.map((personId) => ({ personId }))).onConflictDoNothing();
}

/** Whether the person exists at all, in any game. */
export async function personExists(client: PersonWriteClient, personId: number): Promise<boolean> {
  const [row] = await client.select({ id: sharedPeople.id }).from(sharedPeople).where(eq(sharedPeople.id, personId)).limit(1);
  return Boolean(row);
}

/** Creates the identity and its profile in this game, returns the new id. */
export async function createPerson(
  client: PersonWriteClient,
  game: GameSlug,
  identity: PersonIdentityValues & { handle: string },
  profile: ProfileValues = {}
): Promise<number> {
  const { personProfiles } = gameTables(game);
  const [created] = await client.insert(sharedPeople).values(identity).returning({ id: sharedPeople.id });
  if (!created) throw new Error("Insert returned no row");
  await client.insert(personProfiles).values({ ...profileValuesOf(game, profile), personId: created.id });
  return created.id;
}

export async function updatePersonIdentity(client: PersonWriteClient, personId: number, values: PersonIdentityValues): Promise<void> {
  if (Object.keys(values).length === 0) return;
  await client.update(sharedPeople).set(values).where(eq(sharedPeople.id, personId));
}

export async function updatePersonProfile(client: PersonWriteClient, game: GameSlug, personId: number, values: ProfileValues): Promise<void> {
  const patch = profileValuesOf(game, values);
  if (Object.keys(patch).length === 0) return;
  const { personProfiles } = gameTables(game);
  await client.update(personProfiles).set(patch).where(eq(personProfiles.personId, personId));
}

/** Links an account to the person (`null` unlinks). One account links to at most one person, whatever the game. */
export async function setPersonUser(client: PersonWriteClient, personId: number, userId: string | null): Promise<void> {
  await client.update(sharedPeople).set({ userId }).where(eq(sharedPeople.id, personId));
}

/** Whether the person is referenced by something this game keeps for good (entrants, match stats). */
async function isPersonInUse(client: PersonWriteClient, game: GameSlug, personId: number): Promise<boolean> {
  const { entrants } = gameTables(game);
  const [entrant] = await client.select({ id: entrants.id }).from(entrants).where(eq(entrants.playerId, personId)).limit(1);
  if (entrant) return true;
  if (game !== "valorant") return false;

  const { mapPlayerStats, mapRoundKillsRaw, mapRoundDamagesRaw, mapRoundPlayerPositionsRaw } = valorantTablesOf(game);
  // One at a time, a transaction runs a single query at once.
  const [stat] = await client.select({ id: mapPlayerStats.id }).from(mapPlayerStats).where(eq(mapPlayerStats.personId, personId)).limit(1);
  if (stat) return true;
  const [kill] = await client.select({ id: mapRoundKillsRaw.id }).from(mapRoundKillsRaw).where(or(eq(mapRoundKillsRaw.killerPersonId, personId), eq(mapRoundKillsRaw.victimPersonId, personId))).limit(1);
  if (kill) return true;
  const [damage] = await client.select({ id: mapRoundDamagesRaw.id }).from(mapRoundDamagesRaw).where(or(eq(mapRoundDamagesRaw.attackerPersonId, personId), eq(mapRoundDamagesRaw.receiverPersonId, personId))).limit(1);
  if (damage) return true;
  const [position] = await client.select({ id: mapRoundPlayerPositionsRaw.id }).from(mapRoundPlayerPositionsRaw).where(eq(mapRoundPlayerPositionsRaw.personId, personId)).limit(1);
  return Boolean(position);
}

/**
 * Removes the person from this game: its rosters, memberships and credits here go with it, and
 * the identity too when no other game has a profile for it. Refused ("inUse") when entrants or
 * match stats of this game still point at the person.
 */
export async function removePersonFromGame(client: PersonWriteClient, game: GameSlug, personId: number): Promise<"ok" | "inUse"> {
  if (await isPersonInUse(client, game, personId)) return "inUse";

  const { personProfiles, rosterMemberships, organizationMemberships, productionCredits, liquipediaPersonNames, entrantMembers, matchPlayerPovs } = gameTables(game);
  await client.delete(rosterMemberships).where(eq(rosterMemberships.personId, personId));
  await client.delete(organizationMemberships).where(eq(organizationMemberships.personId, personId));
  await client.delete(productionCredits).where(eq(productionCredits.personId, personId));
  await client.delete(liquipediaPersonNames).where(eq(liquipediaPersonNames.personId, personId));
  await client.delete(entrantMembers).where(eq(entrantMembers.personId, personId));
  await client.delete(matchPlayerPovs).where(eq(matchPlayerPovs.personId, personId));
  await client.delete(personProfiles).where(eq(personProfiles.personId, personId));

  for (const other of GAMES.filter((g) => g !== game)) {
    const profiles = gameTables(other).personProfiles;
    const [row] = await client.select({ id: profiles.personId }).from(profiles).where(eq(profiles.personId, personId)).limit(1);
    if (row) return "ok";
  }
  await client.delete(sharedPeople).where(eq(sharedPeople.id, personId));
  return "ok";
}

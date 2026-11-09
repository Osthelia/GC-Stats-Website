/**
 * GC-Stats - lol-accounts
 *
 * Reads and writes of the Riot accounts of League people (`lol_person_accounts`), shared by the game import, the
 * admin player page and the player merge: a person's accounts, who holds a PUUID, and adding an account. Server only.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, sql } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { lolPersonAccounts, sharedPeople } from "@gc-stats/db";
import { accountRealm, type AccountRealm } from "@gc-stats/lol-stats-engine";
import type { PersonWriteClient } from "@/lib/person-service";

/** A Riot account of a person. */
export interface PersonAccount {
  puuid: string;
  /** Last known "name#tag". */
  riotId: string | null;
  /** Null until the account was seen in a game. */
  platform: string | null;
  cluster: string | null;
  realm: AccountRealm;
  /** leaguepedia, riot or admin. */
  source: string;
  /** ISO time of the latest game played with the account. */
  lastSeenAt: string | null;
}

/** What the import preview shows next to a new account. */
export type PersonAccountSummary = Pick<PersonAccount, "platform" | "realm">;

/** The accounts of a person, the most recently seen first. */
export async function listPersonAccounts(personId: number): Promise<PersonAccount[]> {
  const rows = await db
    .select({
      puuid: lolPersonAccounts.puuid,
      riotId: lolPersonAccounts.riotId,
      platform: lolPersonAccounts.platform,
      cluster: lolPersonAccounts.cluster,
      source: lolPersonAccounts.source,
      lastSeenAt: lolPersonAccounts.lastSeenAt,
    })
    .from(lolPersonAccounts)
    .where(eq(lolPersonAccounts.personId, personId))
    .orderBy(sql`${lolPersonAccounts.lastSeenAt} DESC NULLS LAST`, asc(lolPersonAccounts.createdAt));
  return rows.map((row) => ({ ...row, realm: accountRealm(row.platform), lastSeenAt: row.lastSeenAt?.toISOString() ?? null }));
}

export async function countPersonAccounts(personId: number): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(lolPersonAccounts).where(eq(lolPersonAccounts.personId, personId));
  return row?.count ?? 0;
}

/** The person who holds the account, null when nobody does. */
export async function accountHolder(puuid: string): Promise<{ personId: number; handle: string } | null> {
  const [holder] = await db
    .select({ personId: lolPersonAccounts.personId, handle: sharedPeople.handle })
    .from(lolPersonAccounts)
    .innerJoin(sharedPeople, eq(sharedPeople.id, lolPersonAccounts.personId))
    .where(eq(lolPersonAccounts.puuid, puuid))
    .limit(1);
  return holder ?? null;
}

/** Adds an account to a person. The primary key on the PUUID refuses an account that is already held. */
export async function insertAccount(client: PersonWriteClient, account: typeof lolPersonAccounts.$inferInsert): Promise<void> {
  await client.insert(lolPersonAccounts).values(account);
}

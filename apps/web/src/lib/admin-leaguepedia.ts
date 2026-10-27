/**
 * GC-Stats - admin-leaguepedia
 *
 * The admin side of a LoL tournament's Leaguepedia link: the base page its game list is read from, when
 * the list was last read, and how many games it has. The actions that change them are in
 * actions/admin-leaguepedia.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, sql } from "drizzle-orm";
import { lolLeaguepediaGames, lolLeaguepediaTournaments } from "@gc-stats/db";
import { db } from "@gc-stats/db/client";

export interface LeaguepediaLinkStatus {
  overviewPage: string | null;
  gamesFetchedAt: Date | null;
  gameCount: number;
}

export async function getLeaguepediaLinkStatus(tournamentId: number): Promise<LeaguepediaLinkStatus> {
  const [link] = await db.select().from(lolLeaguepediaTournaments).where(eq(lolLeaguepediaTournaments.tournamentId, tournamentId));
  const [counted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lolLeaguepediaGames)
    .where(eq(lolLeaguepediaGames.tournamentId, tournamentId));
  return { overviewPage: link?.overviewPage ?? null, gamesFetchedAt: link?.gamesFetchedAt ?? null, gameCount: counted?.count ?? 0 };
}

const MAX_BASE_PAGE_LENGTH = 200;
// Characters a MediaWiki page title cannot hold.
const FORBIDDEN_IN_TITLE = /[#<>[\]|{}]/;

/**
 * The base page as Leaguepedia writes it in Cargo: spaces, not underscores, single spaces. Null when the
 * input cannot be a page title, so nothing is sent to Leaguepedia for it.
 */
export function normalizeBasePage(input: string): string | null {
  const page = input.trim().replaceAll("_", " ").replace(/\s+/g, " ");
  if (page === "" || page.length > MAX_BASE_PAGE_LENGTH || FORBIDDEN_IN_TITLE.test(page)) return null;
  if (page.startsWith("/") || page.endsWith("/")) return null;
  return page;
}

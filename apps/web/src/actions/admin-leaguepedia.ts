/**
 * GC-Stats - admin-leaguepedia
 *
 * Admin server actions for a LoL tournament's Leaguepedia link. Both read the game list from
 * Leaguepedia, so each one is a request and the result says what happened to the list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { PERMISSIONS, lolTournaments } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { getLeaguepediaLinkStatus, normalizeBasePage } from "@/lib/admin-leaguepedia";
import { refreshGameList } from "@/lib/leaguepedia-games";
import type { LeaguepediaError } from "@/lib/leaguepedia-client";
import { getAdminMatch } from "@/lib/admin-matches";
import { fetchLeaguepediaGameIntoMatch, type FetchLeaguepediaGameResult } from "@/lib/lol-import/fetch-leaguepedia-game";
import type { LeaguepediaGameMode } from "@/lib/lol-import/leaguepedia-game";
import { matchTag } from "@/lib/cache-tags";
import { updateTag } from "next/cache";

export type { LeaguepediaGameOption } from "@/lib/admin-leaguepedia";

export type LeaguepediaLinkError = "invalidBasePage" | "notFound" | "notLinked" | "missingConfig" | "fetch";

export type LeaguepediaLinkResult = { ok: true; games: number } | { ok: false; error: LeaguepediaLinkError };

async function requireLolActor(): Promise<string> {
  const access = await requireActorPermission(PERMISSIONS.tournamentsManage, "lol");
  return access.userId;
}

/** Saves the base page and reads the game list. The link is only saved when the list was read. */
export async function saveLeaguepediaBasePage(tournamentId: number, basePage: string): Promise<LeaguepediaLinkResult> {
  const actorUserId = await requireLolActor();
  const overviewPage = normalizeBasePage(basePage);
  if (!overviewPage) return { ok: false, error: "invalidBasePage" };

  const [tournament] = await db.select({ id: lolTournaments.id }).from(lolTournaments).where(eq(lolTournaments.id, tournamentId));
  if (!tournament) return { ok: false, error: "notFound" };

  const result = await refreshGameList(tournamentId, overviewPage);
  if (!result.ok) return { ok: false, error: fetchError(result.error) };

  await logActivity({
    subject: "tournament",
    subjectId: tournamentId,
    event: "updated",
    description: `Set the Leaguepedia base page of tournament #${tournamentId} to ${overviewPage} (${result.data} games)`,
    actorUserId,
  });
  return { ok: true, games: result.data };
}

/** Reads the game list again from the saved base page. */
export async function refreshLeaguepediaGameList(tournamentId: number): Promise<LeaguepediaLinkResult> {
  const actorUserId = await requireLolActor();
  const { overviewPage } = await getLeaguepediaLinkStatus(tournamentId);
  if (!overviewPage) return { ok: false, error: "notLinked" };

  const result = await refreshGameList(tournamentId, overviewPage);
  if (!result.ok) return { ok: false, error: fetchError(result.error) };

  await logActivity({
    subject: "tournament",
    subjectId: tournamentId,
    event: "updated",
    description: `Refreshed the Leaguepedia game list of tournament #${tournamentId} (${result.data} games)`,
    actorUserId,
  });
  return { ok: true, games: result.data };
}

export type FetchGameInput = { leaguepediaGameId: string; order: number; mode: LeaguepediaGameMode };

/** Stores a Leaguepedia game as game `order` of the series: fetch, renew or reprocess (see leaguepedia-game.ts). */
export async function fetchLeaguepediaGameForMatch(tournamentId: number, matchId: number, input: FetchGameInput): Promise<FetchLeaguepediaGameResult> {
  const actorUserId = await requireLolActor();
  const match = await getAdminMatch("lol", matchId);
  if (!match || match.tournamentId !== tournamentId) return { ok: false, error: { kind: "noData" } };

  const result = await fetchLeaguepediaGameIntoMatch({ tournamentId, matchId, ...input });
  if (result.ok) {
    updateTag(matchTag(matchId));
    await logActivity({
      subject: "match",
      subjectId: matchId,
      event: "updated",
      description: `${input.mode === "renew" ? "Renewed" : input.mode === "reprocess" ? "Reprocessed" : "Fetched"} game ${input.order} of match #${matchId} from Leaguepedia`,
      actorUserId,
      properties: { leaguepediaGameId: input.leaguepediaGameId, fromBucket: result.fromBucket },
    });
  }
  return result;
}

function fetchError(error: LeaguepediaError): LeaguepediaLinkError {
  return error.kind === "missingConfig" ? "missingConfig" : "fetch";
}

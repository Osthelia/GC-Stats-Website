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
import { refreshGameList, type GameListError } from "@/lib/leaguepedia-games";
import { getAdminMatch } from "@/lib/admin-matches";
import { prepareLeaguepediaGame, commitLeaguepediaGame, type GameRef, type PrepareResult, type CommitResult, type PlayerMapping } from "@/lib/lol-import/fetch-league-game";
import type { LeaguepediaGameMode } from "@/lib/lol-import/leaguepedia-game";
import type { LeagueSide } from "@gc-stats/lol-stats-engine";
import { matchTag } from "@/lib/cache-tags";
import { updateTag } from "next/cache";

export type { LeaguepediaGameOption } from "@/lib/admin-leaguepedia";

export type LeaguepediaLinkError = "invalidBasePage" | "notFound" | "notLinked" | "missingConfig" | "fetch" | "gameClaimed";

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
    game: "lol",
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
    game: "lol",
    subject: "tournament",
    subjectId: tournamentId,
    event: "updated",
    description: `Refreshed the Leaguepedia game list of tournament #${tournamentId} (${result.data} games)`,
    actorUserId,
  });
  return { ok: true, games: result.data };
}

export type { LeaguepediaPreview, PreviewPlayer, PlayerMapping, LeaguepediaGameError, GameRef } from "@/lib/lol-import/fetch-league-game";

export type PrepareGameInput = { game: GameRef; mode: LeaguepediaGameMode };
export type CommitGameInput = { mode: LeaguepediaGameMode; gameId: number | null; game: GameRef; order: number; entrantIdBySide: Record<LeagueSide, number>; mappings: PlayerMapping[]; roleOverrides: Record<string, string | null> };

/** The match, when it exists and belongs to the tournament in the URL. */
async function matchOfTournament(tournamentId: number, matchId: number) {
  const match = await getAdminMatch("lol", matchId);
  return match && match.tournamentId === tournamentId ? match : null;
}

/** Loads a Leaguepedia game for the preview. Nothing is written except the raw copy in the bucket. */
export async function prepareLeaguepediaGameForMatch(tournamentId: number, matchId: number, input: PrepareGameInput): Promise<PrepareResult> {
  await requireLolActor();
  if (!(await matchOfTournament(tournamentId, matchId))) return { ok: false, error: { kind: "noData" } };
  return prepareLeaguepediaGame({ tournamentId, matchId, ...input });
}

/** Stores the game with the admin's player links and entrant sides. */
export async function commitLeaguepediaGameForMatch(tournamentId: number, matchId: number, input: CommitGameInput): Promise<CommitResult> {
  const actorUserId = await requireLolActor();
  if (!(await matchOfTournament(tournamentId, matchId))) return { ok: false, error: { kind: "noData" } };

  const result = await commitLeaguepediaGame({ tournamentId, matchId, ...input });
  if (result.ok) {
    updateTag(matchTag(matchId));
    await logActivity({
      game: "lol",
      subject: "match",
      subjectId: matchId,
      event: "updated",
      description: `Stored game ${input.order} of match #${matchId} from ${input.game.source === "riot" ? "Riot" : "Leaguepedia"} (${input.mode})`,
      actorUserId,
      properties: { mode: input.mode, source: input.game.source, gameId: result.gameId, linkedAccounts: input.mappings.length },
    });
  }
  return result;
}

function fetchError(error: GameListError): LeaguepediaLinkError {
  if (error.kind === "missingConfig") return "missingConfig";
  return error.kind === "gameClaimed" ? "gameClaimed" : "fetch";
}

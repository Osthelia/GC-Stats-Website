/**
 * GC-Stats - admin-lol-games
 *
 * Admin server actions for the games of a League of Legends series, entered
 * by hand. They follow the Valorant map actions in admin-matches.ts: the
 * caller needs tournamentsManage, the match must belong to the tournament in
 * the URL, every change is logged, and the match score is synced once the
 * transaction has committed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq, and, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { PERMISSIONS, leagueTablesOf } from "@gc-stats/db";
import { gameHasSeriesGames, type GameSlug } from "@gc-stats/db/game";
import { requireActorPermission } from "@/lib/rbac";
import { matchTag } from "@/lib/cache-tags";
import { getAdminMatch, type AdminMatchDetail } from "@/lib/admin-matches";
import { maybeAutoCompleteMatchFromMaps } from "@/lib/bracket/auto-complete-match";
import { diffChanges, logActivity } from "@/lib/activity-log";

export type LeagueGameField = "order" | "winnerEntrantId" | "isCompleted" | "durationSeconds" | "note";
export type LeagueGameFieldErrors = Partial<Record<LeagueGameField, string>>;
export type LeagueGameInput = {
  order: string;
  /** Entrant id of the winner, "" when none yet. */
  winnerEntrantId: string;
  isCompleted: boolean;
  isForfeit: boolean;
  /** Seconds, "" when unknown. */
  durationSeconds: string;
  note: string;
};
export type LeagueGameResult = { ok: true; id: number } | { ok: false; error: "notFound" } | { ok: false; fieldErrors: LeagueGameFieldErrors };
export type DeleteLeagueGameResult = { ok: true } | { ok: false; error: "notFound" };

async function requireTournamentsActor(game: GameSlug): Promise<string> {
  const access = await requireActorPermission(PERMISSIONS.tournamentsManage, game);
  return access.userId;
}

/** The match, when it exists and belongs to the tournament in the URL. */
async function loadMatchOfTournament(game: GameSlug, tournamentId: number, matchId: number): Promise<AdminMatchDetail | null> {
  const match = await getAdminMatch(game, matchId);
  return match && match.tournamentId === tournamentId ? match : null;
}

/** Keeps the match score in line with its games after a manual change; never fails the save itself. */
async function syncMatchScoreFromGames(game: GameSlug, matchId: number): Promise<void> {
  try {
    await maybeAutoCompleteMatchFromMaps(game, matchId);
  } catch (err) {
    console.warn(`[admin-lol-games] match score sync failed for match #${matchId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function validateLeagueGameInput(game: GameSlug, input: LeagueGameInput, match: Pick<AdminMatchDetail, "entrantAId" | "entrantBId">, matchId: number, currentGameId: number | null): Promise<LeagueGameFieldErrors> {
  const { games } = leagueTablesOf(game);
  const fieldErrors: LeagueGameFieldErrors = {};

  const order = Number(input.order);
  if (!Number.isInteger(order) || order < 1) {
    fieldErrors.order = "invalid";
  } else {
    const [conflict] = await db
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.matchId, matchId), eq(games.order, order), currentGameId !== null ? ne(games.id, currentGameId) : undefined))
      .limit(1);
    if (conflict) fieldErrors.order = "duplicateOrder";
  }

  // A forfeited game is always completed, and a completed game needs a winner (LoL has no draws).
  const isCompleted = input.isCompleted || input.isForfeit;
  const winnerId = input.winnerEntrantId === "" ? null : Number(input.winnerEntrantId);
  if (winnerId !== null && winnerId !== match.entrantAId && winnerId !== match.entrantBId) fieldErrors.winnerEntrantId = "notAnEntrant";
  if (isCompleted && winnerId === null) fieldErrors.winnerEntrantId = "winnerRequired";
  if (!isCompleted && winnerId !== null) fieldErrors.isCompleted = "notCompleted";

  if (input.durationSeconds.trim() !== "") {
    const seconds = Number(input.durationSeconds);
    if (!Number.isInteger(seconds) || seconds < 0) fieldErrors.durationSeconds = "invalid";
  }
  if (input.note.trim().length > 500) fieldErrors.note = "tooLong";

  return fieldErrors;
}

function leagueGameValues(input: LeagueGameInput) {
  const isCompleted = input.isCompleted || input.isForfeit;
  return {
    order: Number(input.order),
    winnerEntrantId: input.winnerEntrantId === "" ? null : Number(input.winnerEntrantId),
    isCompleted,
    isForfeit: input.isForfeit,
    durationSeconds: input.durationSeconds.trim() === "" ? null : Number(input.durationSeconds),
    note: input.note.trim() || null,
  };
}

export async function addLeagueGame(game: GameSlug, tournamentId: number, matchId: number, input: LeagueGameInput): Promise<LeagueGameResult> {
  if (!gameHasSeriesGames(game)) return { ok: false, error: "notFound" };
  const actorUserId = await requireTournamentsActor(game);
  const match = await loadMatchOfTournament(game, tournamentId, matchId);
  if (!match) return { ok: false, error: "notFound" };

  const fieldErrors = await validateLeagueGameInput(game, input, match, matchId, null);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const { games } = leagueTablesOf(game);
  const values = leagueGameValues(input);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(games)
      .values({ matchId, ...values })
      .returning({ id: games.id });
    if (!row) throw new Error("Insert returned no row");
    await logActivity({ game, subject: "match", subjectId: matchId, event: "updated", description: `Added game ${values.order} to match #${matchId}`, actorUserId, properties: { section: "games", gameId: row.id } }, tx);
    return row;
  });
  await syncMatchScoreFromGames(game, matchId);
  updateTag(matchTag(matchId));

  return { ok: true, id: created.id };
}

export async function updateLeagueGame(game: GameSlug, tournamentId: number, matchId: number, gameId: number, input: LeagueGameInput): Promise<LeagueGameResult> {
  if (!gameHasSeriesGames(game)) return { ok: false, error: "notFound" };
  const actorUserId = await requireTournamentsActor(game);
  const match = await loadMatchOfTournament(game, tournamentId, matchId);
  if (!match) return { ok: false, error: "notFound" };

  const { games } = leagueTablesOf(game);
  const [existing] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.matchId, matchId)))
    .limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const fieldErrors = await validateLeagueGameInput(game, input, match, matchId, gameId);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const values = leagueGameValues(input);
  await db.transaction(async (tx) => {
    await tx.update(games).set(values).where(eq(games.id, gameId));
    const changes = diffChanges(existing, values);
    if (Object.keys(changes).length > 0) {
      await logActivity({ game, subject: "match", subjectId: matchId, event: "updated", description: `Updated game ${values.order} of match #${matchId}`, actorUserId, changes, properties: { section: "games", gameId } }, tx);
    }
  });
  await syncMatchScoreFromGames(game, matchId);
  updateTag(matchTag(matchId));

  return { ok: true, id: gameId };
}

export async function deleteLeagueGame(game: GameSlug, tournamentId: number, matchId: number, gameId: number): Promise<DeleteLeagueGameResult> {
  if (!gameHasSeriesGames(game)) return { ok: false, error: "notFound" };
  const actorUserId = await requireTournamentsActor(game);
  const match = await loadMatchOfTournament(game, tournamentId, matchId);
  if (!match) return { ok: false, error: "notFound" };

  const { games } = leagueTablesOf(game);
  const [existing] = await db
    .select({ id: games.id, order: games.order })
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.matchId, matchId)))
    .limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(games).where(eq(games.id, gameId));
    await logActivity({ game, subject: "match", subjectId: matchId, event: "updated", description: `Deleted game ${existing.order} of match #${matchId}`, actorUserId, properties: { section: "games", gameId } }, tx);
  });
  await syncMatchScoreFromGames(game, matchId);
  updateTag(matchTag(matchId));

  return { ok: true };
}

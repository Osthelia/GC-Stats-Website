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
import { draftProblem, draftStep, stepSide, type DraftEntry, type DraftProblem, type LeagueSide } from "@gc-stats/lol-stats-engine";
import { requireActorPermission } from "@/lib/rbac";
import { matchTag } from "@/lib/cache-tags";
import { getAdminMatch, type AdminMatchDetail } from "@/lib/admin-matches";
import { maybeAutoCompleteMatchFromMaps } from "@/lib/bracket/auto-complete-match";
import { diffChanges, logActivity } from "@/lib/activity-log";
import { getChampionNamesForPatch } from "@/lib/data-dragon-client";

export type LeagueGameField = "order" | "apiMatchId" | "winnerEntrantId" | "isCompleted" | "note";
export type LeagueGameFieldErrors = Partial<Record<LeagueGameField, string>>;
export type LeagueGameInput = {
  order: string;
  /** Riot match id, e.g. "EUW1_6123456789"; "" when the game was not played on Riot's servers. */
  apiMatchId: string;
  /** Entrant id of the winner, "" when none yet. */
  winnerEntrantId: string;
  isCompleted: boolean;
  isForfeit: boolean;
  note: string;
};
export type LeagueGameResult = { ok: true; id: number } | { ok: false; error: "notFound" } | { ok: false; fieldErrors: LeagueGameFieldErrors };
export type DeleteLeagueGameResult = { ok: true } | { ok: false; error: "notFound" };

const RIOT_MATCH_ID_RE = /^[A-Z0-9]+_\d+$/;

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

  // A Riot match id is "<platform>_<number>", e.g. EUW1_6123456789. Unique, so one Riot game can't attach to two rows.
  const apiMatchId = input.apiMatchId.trim();
  if (apiMatchId !== "") {
    if (!RIOT_MATCH_ID_RE.test(apiMatchId)) {
      fieldErrors.apiMatchId = "invalidMatchId";
    } else {
      const [conflict] = await db
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.apiMatchId, apiMatchId), currentGameId !== null ? ne(games.id, currentGameId) : undefined))
        .limit(1);
      if (conflict) fieldErrors.apiMatchId = "duplicateMatchId";
    }
  }

  // A forfeited game is always completed, and a completed game needs a winner (LoL has no draws).
  const isCompleted = input.isCompleted || input.isForfeit;
  const winnerId = input.winnerEntrantId === "" ? null : Number(input.winnerEntrantId);
  if (winnerId !== null && winnerId !== match.entrantAId && winnerId !== match.entrantBId) fieldErrors.winnerEntrantId = "notAnEntrant";
  if (isCompleted && winnerId === null) fieldErrors.winnerEntrantId = "winnerRequired";
  if (!isCompleted && winnerId !== null) fieldErrors.isCompleted = "notCompleted";

  if (input.note.trim().length > 500) fieldErrors.note = "tooLong";

  return fieldErrors;
}

function leagueGameValues(input: LeagueGameInput) {
  const isCompleted = input.isCompleted || input.isForfeit;
  const apiMatchId = input.apiMatchId.trim() || null;
  return {
    order: Number(input.order),
    apiMatchId,
    // The Riot platform is the prefix of the match id, so it is never entered separately.
    platformId: apiMatchId ? apiMatchId.split("_")[0] : null,
    winnerEntrantId: input.winnerEntrantId === "" ? null : Number(input.winnerEntrantId),
    isCompleted,
    isForfeit: input.isForfeit,
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

export type LeagueDraftInput = {
  /** Entrant id of the blue side. Fixed for an imported game: Riot's blue team decides it. */
  blueEntrantId: number;
  /** The filled steps. A step left out is empty, which is normal for a skipped ban. */
  steps: DraftEntry[];
  /** Picks that are not placed on a step yet, by team. */
  unplacedPicks: { side: LeagueSide; championName: string }[];
  /** The side with the first pick. It sets which side makes each step (see stepSide): the first ban and the first pick are its. */
  firstPick: LeagueSide;
};
export type LeagueDraftError =
  | { kind: "notFound" }
  | { kind: "entrantsUnset" }
  | { kind: "blueNotAnEntrant" }
  | { kind: "blueLocked" }
  | { kind: "firstPickLocked" }
  | { kind: "invalidFirstPick" }
  | { kind: "draftProblem"; problem: DraftProblem };
export type LeagueDraftResult = { ok: true } | { ok: false; error: LeagueDraftError };

/**
 * Saves the draft of one game. One transaction replaces its draft rows and marks the draft as edited by hand, so a
 * re-import keeps it and only compares it.
 */
export async function saveLeagueGameDraft(game: GameSlug, tournamentId: number, matchId: number, gameId: number, input: LeagueDraftInput): Promise<LeagueDraftResult> {
  if (!gameHasSeriesGames(game)) return { ok: false, error: { kind: "notFound" } };
  const actorUserId = await requireTournamentsActor(game);
  const match = await loadMatchOfTournament(game, tournamentId, matchId);
  if (!match) return { ok: false, error: { kind: "notFound" } };
  if (match.entrantAId === null || match.entrantBId === null) return { ok: false, error: { kind: "entrantsUnset" } };

  const { games, gameTeamStats, gameDraft } = leagueTablesOf(game);
  const [existing] = await db
    .select({ id: games.id, order: games.order, source: games.source, draftFirstPick: games.draftFirstPick })
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.matchId, matchId)))
    .limit(1);
  if (!existing) return { ok: false, error: { kind: "notFound" } };

  const entrantAId = match.entrantAId;
  const entrantBId = match.entrantBId;

  // check that side and firstpick are not changed if they are imported
  if (input.blueEntrantId !== entrantAId && input.blueEntrantId !== entrantBId) return { ok: false, error: { kind: "blueNotAnEntrant" } };
  if (input.firstPick !== "blue" && input.firstPick !== "red") return { ok: false, error: { kind: "invalidFirstPick" } };
  if (existing.source !== null) {
    const [blueTeam] = await db
      .select({ entrantId: gameTeamStats.entrantId })
      .from(gameTeamStats)
      .where(and(eq(gameTeamStats.gameId, gameId), eq(gameTeamStats.side, "blue")))
      .limit(1);
    if (blueTeam && blueTeam.entrantId !== input.blueEntrantId) return { ok: false, error: { kind: "blueLocked" } };
    if (existing.draftFirstPick !== null && input.firstPick !== existing.draftFirstPick) return { ok: false, error: { kind: "firstPickLocked" } };
  }

  const problem = draftProblem({
    steps: input.steps,
    unplacedPicks: input.unplacedPicks.map((pick) => pick.championName),
    knownChampions: new Set(await getChampionNamesForPatch(match.patch)),
  });
  if (problem) return { ok: false, error: { kind: "draftProblem", problem } };

  const entrantOf = (side: LeagueSide): number => (side === "blue" ? input.blueEntrantId : input.blueEntrantId === entrantAId ? entrantBId : entrantAId);
  const stepRows = input.steps.flatMap((entry) => {
    const step = draftStep(entry.step);
    return step ? [{ 
      gameId, 
      entrantId: entrantOf(stepSide(step, input.firstPick)), 
      championName: entry.championName, 
      type: step.type, order: step.step 
    }] : [];
  });
  const pickRows = input.unplacedPicks.map((pick) => ({ gameId, entrantId: entrantOf(pick.side), championName: pick.championName, type: "pick", order: null }));

  await db.transaction(async (tx) => {
    await tx.delete(gameDraft).where(eq(gameDraft.gameId, gameId));
    const rows = [...stepRows, ...pickRows];
    if (rows.length > 0) await tx.insert(gameDraft).values(rows);
    await tx.update(games).set({ draftEditedAt: new Date(), draftImportDiffers: false, draftFirstPick: input.firstPick, draftBlueEntrantId: input.blueEntrantId }).where(eq(games.id, gameId));
    await logActivity({ game, subject: "match", subjectId: matchId, event: "updated", description: `Edited the draft of game ${existing.order} of match #${matchId}`, actorUserId, properties: { section: "draft", gameId, steps: stepRows.length, unplacedPicks: pickRows.length, firstPick: input.firstPick } }, tx);
  });
  updateTag(matchTag(matchId));
  return { ok: true };
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

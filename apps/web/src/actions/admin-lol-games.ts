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

import { eq, and, ne, inArray } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { PERMISSIONS, gameTables, leagueTablesOf } from "@gc-stats/db";
import { gameHasSeriesGames, type GameSlug } from "@gc-stats/db/game";
import { draftProblem, draftStep, stepSide, type DraftEntry, type DraftProblem, type LeagueSide } from "@gc-stats/lol-stats-engine";
import { requireActorPermission } from "@/lib/rbac";
import { matchTag } from "@/lib/cache-tags";
import { getAdminMatch, type AdminMatchDetail } from "@/lib/admin-matches";
import { maybeAutoCompleteMatchFromMaps } from "@/lib/bracket/auto-complete-match";
import { diffChanges, logActivity } from "@/lib/activity-log";
import { fetchChampionNamesForPatch, getChampionNamesForPatch } from "@/lib/data-dragon-client";
import { WIKICODE_MAX_LENGTH } from "@/lib/wikicode-import";
import { draftFromWikicode, parseLolMatchWikicode, resolveChampionNames, wikicodeChampionNames, type WikicodeLolGame } from "@/lib/liquipedia-lol-match-wikicode";
import { draftBlockedBy, planGameFields, type DraftBlock, type GameField, type GameFieldPlan } from "@/lib/liquipedia-lol-import-rules";
import {
  decideLiquipediaLinks,
  pastedOpponentsSwapped,
  planLiquipediaLinks,
  writeLiquipediaLinks,
  type LiquipediaImportConflict,
  type LiquipediaLinkResolutions,
} from "@/lib/liquipedia-team-links";

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

/** The entrant that played `side`, given the blue one. */
function entrantOfSide(side: LeagueSide, blueEntrantId: number, entrantAId: number, entrantBId: number): number {
  return side === "blue" ? blueEntrantId : blueEntrantId === entrantAId ? entrantBId : entrantAId;
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

  const entrantOf = (side: LeagueSide): number => entrantOfSide(side, input.blueEntrantId, entrantAId, entrantBId);
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

// --- Liquipedia wikicode import --------------------------------------------
// Paste a `{{Match}}` of a League series: its games and drafts fill what is still empty. The wikicode is the
// lowest-priority source: it never overwrites Riot or Leaguepedia data, anything entered by hand or an earlier
// import, and a Riot or Leaguepedia import later replaces what it filled.

export type ImportLeagueWikicodeError = "required" | "tooLong" | "missingTeams" | "oneMatchOnly" | "noGames" | "invalidResolution";

/** What happened to the draft of one game. */
export type LeagueWikicodeDraftOutcome =
  | { status: "written" }
  /** Not touched: the game already has a draft or data that ranks higher. */
  | { status: "kept"; reason: DraftBlock }
  /** The wikicode has no draft for this game, or no `team1side` to place it. */
  | { status: "none"; reason: "noDraft" | "noSide" };

export type LeagueWikicodeGameResult = {
  order: number;
  created: boolean;
  /** Fields the wikicode filled on a game that already existed (a created game has all of them filled). */
  filled: GameField[];
  /** Fields where the game has another value than the wikicode: reported, not changed. */
  differs: GameField[];
  draft: LeagueWikicodeDraftOutcome;
};

export type ImportLeagueWikicodeResult =
  | {
      ok: true;
      linkedNames: number;
      /** The series was decided by forfeit: nothing was written, the admin sets the forfeit by hand. */
      forfeit: boolean;
      patchSet: string | null;
      /** The wikicode's best-of when it is not the match's; the match keeps its own. */
      bestOfDiffers: number | null;
      /** A draft was written with blue as the first pick, because the wikicode doesn't say. */
      firstPickAssumed: boolean;
      games: LeagueWikicodeGameResult[];
    }
  | { ok: false; error: ImportLeagueWikicodeError }
  | { ok: false; error: "unknownChampions"; names: string[] }
  | { ok: false; error: "duplicateChampion"; order: number; championName: string }
  | { ok: false; error: "liquipediaConflict"; conflicts: LiquipediaImportConflict[] };

type ExistingLeagueGame = { id: number; order: number; winnerEntrantId: number | null; durationSeconds: number | null; source: string | null; draftEditedAt: Date | null; draftFirstPick: string | null; draftBlueEntrantId: number | null };

type PlannedGame = {
  wiki: WikicodeLolGame;
  existing: ExistingLeagueGame | null;
  values: GameFieldPlan["values"];
  result: LeagueWikicodeGameResult;
  draft: { rows: { step: number | null; side: LeagueSide; type: "ban" | "pick"; championName: string }[]; blueEntrantId: number; firstPick: LeagueSide } | null;
};

export async function importLeagueMatchWikicode(game: GameSlug, matchId: number, wikicode: string, resolutions: LiquipediaLinkResolutions = {}): Promise<ImportLeagueWikicodeResult> {
  if (!gameHasSeriesGames(game)) return { ok: false, error: "missingTeams" };
  const actorUserId = await requireTournamentsActor(game);

  const trimmed = wikicode.trim();
  if (!trimmed) return { ok: false, error: "required" };
  if (trimmed.length > WIKICODE_MAX_LENGTH) return { ok: false, error: "tooLong" };

  const match = await getAdminMatch(game, matchId);
  if (!match || match.entrantAId === null || match.entrantBId === null) return { ok: false, error: "missingTeams" };
  // Opponent 1 of the wikicode is "A" below. When the paste lists the teams the other way round, A is our entrant B.
  const swapped = await pastedOpponentsSwapped(game, trimmed, [match.entrantAId, match.entrantBId]);
  const entrantAId = swapped ? match.entrantBId : match.entrantAId;
  const entrantBId = swapped ? match.entrantAId : match.entrantBId;

  const parsed = parseLolMatchWikicode(trimmed);
  if (!parsed.ok) return parsed;
  const wikiMatch = parsed.match;
  const bestOfDiffers = wikiMatch.bestOf !== null && wikiMatch.bestOf !== match.bestOf ? wikiMatch.bestOf : null;

  // A forfeit has no games: the admin sets it by hand, so nothing is written.
  if (wikiMatch.forfeit && wikiMatch.games.length === 0) return { ok: true, linkedNames: 0, forfeit: true, patchSet: null, bestOfDiffers, firstPickAssumed: false, games: [] };
  if (wikiMatch.games.length === 0) return { ok: false, error: "noGames" };

  // One unknown champion stops the import: the names are stored as written, so a guess would stay wrong.
  // Catalogs are stored by imports, so a patch nothing was imported for has none yet: Data Dragon is asked then.
  const displayNames = await fetchChampionNamesForPatch(match.patch ?? wikiMatch.patch);
  const champions = resolveChampionNames(wikiMatch.games.flatMap(wikicodeChampionNames), displayNames);
  if (!champions.ok) return { ok: false, error: "unknownChampions", names: champions.unknown };

  const linkDecision = decideLiquipediaLinks(await planLiquipediaLinks(game, trimmed, [entrantAId, entrantBId]), resolutions);
  if (!linkDecision.ok) return linkDecision;

  const { matches } = gameTables(game);
  const { games, gameTeamStats, gameDraft } = leagueTablesOf(game);
  const existingGames: ExistingLeagueGame[] = await db
    .select({ id: games.id, order: games.order, winnerEntrantId: games.winnerEntrantId, durationSeconds: games.durationSeconds, source: games.source, draftEditedAt: games.draftEditedAt, draftFirstPick: games.draftFirstPick, draftBlueEntrantId: games.draftBlueEntrantId })
    .from(games)
    .where(eq(games.matchId, matchId));
  const existingIds = existingGames.map((g) => g.id);
  const [draftRowGames, teamStatGames] = existingIds.length
    ? await Promise.all([
        db.selectDistinct({ gameId: gameDraft.gameId }).from(gameDraft).where(inArray(gameDraft.gameId, existingIds)),
        db.selectDistinct({ gameId: gameTeamStats.gameId }).from(gameTeamStats).where(inArray(gameTeamStats.gameId, existingIds)),
      ])
    : [[], []];
  const withDraftRows = new Set(draftRowGames.map((r) => r.gameId));
  const withTeamStats = new Set(teamStatGames.map((r) => r.gameId));

  const planned: PlannedGame[] = [];
  for (const wiki of wikiMatch.games) {
    const existing = existingGames.find((g) => g.order === wiki.order) ?? null;
    const wikiWinnerEntrantId = wiki.winner === 1 ? entrantAId : wiki.winner === 2 ? entrantBId : null;
    const { values, filled, differs } = planGameFields(existing, { winnerEntrantId: wikiWinnerEntrantId, lengthSeconds: wiki.lengthSeconds });

    const hasDraft = wikicodeChampionNames(wiki).some((name) => name !== "");
    const blockedBy = existing ? draftBlockedBy({ ...existing, hasDraftRows: withDraftRows.has(existing.id), hasTeamStats: withTeamStats.has(existing.id) }) : null;
    let outcome: LeagueWikicodeDraftOutcome = { status: "none", reason: "noDraft" };
    let draft: PlannedGame["draft"] = null;
    if (hasDraft && blockedBy) {
      outcome = { status: "kept", reason: blockedBy };
    } else if (hasDraft) {
      // The blue side already on the game wins over the wikicode, as does the first pick; blue is assumed for the first pick otherwise.
      const blueEntrantId = existing?.draftBlueEntrantId ?? (wiki.team1Side === "blue" ? entrantAId : wiki.team1Side === "red" ? entrantBId : null);
      if (blueEntrantId === null) {
        outcome = { status: "none", reason: "noSide" };
      } else {
        const firstPick: LeagueSide = existing?.draftFirstPick === "red" ? "red" : "blue";
        const team1Side: LeagueSide = blueEntrantId === entrantAId ? "blue" : "red";
        const fromWikicode = draftFromWikicode(wiki, champions.byWikicodeName, team1Side, firstPick);
        const problem = draftProblem({ steps: fromWikicode.steps, unplacedPicks: fromWikicode.unplacedPicks.map((p) => p.championName), knownChampions: new Set(displayNames) });
        // The steps come from the fixed table and the names are resolved, so a champion used twice is the only problem left.
        if (problem?.kind === "duplicateChampion") return { ok: false, error: "duplicateChampion", order: wiki.order, championName: problem.championName };
        if (problem) throw new Error(`Unexpected draft problem in imported wikicode: ${problem.kind}`);
        draft = {
          blueEntrantId,
          firstPick,
          rows: [
            ...fromWikicode.steps.map((s) => ({ step: s.step, side: s.side, type: "ban" as const, championName: s.championName })),
            ...fromWikicode.unplacedPicks.map((p) => ({ step: null, side: p.side, type: "pick" as const, championName: p.championName })),
          ],
        };
        outcome = { status: "written" };
      }
    }
    planned.push({ wiki, existing, values, draft, result: { order: wiki.order, created: !existing, filled, differs, draft: outcome } });
  }

  const patchSet = match.patch === null ? wikiMatch.patch : null;
  await db.transaction(async (tx) => {
    await writeLiquipediaLinks(tx, game, linkDecision.linksToWrite);
    if (patchSet !== null) await tx.update(matches).set({ patch: patchSet }).where(eq(matches.id, matchId));

    for (const plan of planned) {
      let gameId = plan.existing?.id;
      if (gameId === undefined) {
        const [row] = await tx.insert(games).values({ matchId, order: plan.wiki.order, ...plan.values }).returning({ id: games.id });
        if (!row) throw new Error("Insert returned no row");
        gameId = row.id;
      } else if (Object.keys(plan.values).length > 0) {
        await tx.update(games).set(plan.values).where(eq(games.id, gameId));
      }
      if (!plan.draft) continue;

      const { blueEntrantId } = plan.draft;
      await tx.delete(gameDraft).where(eq(gameDraft.gameId, gameId));
      await tx.insert(gameDraft).values(plan.draft.rows.map((row) => ({ gameId: gameId!, entrantId: entrantOfSide(row.side, blueEntrantId, entrantAId, entrantBId), championName: row.championName, type: row.type, order: row.step })));
      // Not marked as edited: a later Riot or Leaguepedia import replaces this draft like any import.
      await tx.update(games).set({ draftBlueEntrantId: plan.draft.blueEntrantId, draftFirstPick: plan.draft.firstPick }).where(eq(games.id, gameId));
    }
    await logActivity({ game, subject: "match", subjectId: matchId, event: "updated", description: `Imported Liquipedia wikicode into match #${matchId}`, actorUserId, properties: { section: "wikicodeImport", games: planned.length } }, tx);
  });
  await syncMatchScoreFromGames(game, matchId);
  updateTag(matchTag(matchId));

  return {
    ok: true,
    linkedNames: linkDecision.linksToWrite.length,
    forfeit: false,
    patchSet,
    bestOfDiffers,
    firstPickAssumed: planned.some((p) => p.result.draft.status === "written" && !p.existing?.draftFirstPick),
    games: planned.map((p) => p.result),
  };
}

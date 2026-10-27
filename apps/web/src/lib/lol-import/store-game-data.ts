/**
 * GC-Stats - store-game-data
 *
 * Writes one LoL game of a series: the game row, its summary rows (players,
 * teams, draft), the derived timeline stats on those rows, and the raw frame
 * and event rows. The raw match and timeline JSON are not stored here: they
 * go to the LoL imports bucket (PR 6b). A re-import replaces
 * everything the game had before. One transaction, guarded by an advisory lock
 * on the Riot match id, so two imports of the same game never interleave. The
 * series auto-complete runs after the commit, as for Valorant, so a failed
 * auto-complete never rolls back the import.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, sql } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { leagueTablesOf } from "@gc-stats/db";
import {
  buildGameSummary,
  buildTimelineRows,
  computeFirstBlood,
  computeFirstTower,
  computeLaneDiffs,
  computeObjectiveTimings,
  sideForTeamId,
  type LanePlayer,
  type LeagueSide,
  type LeagueSummaryContext,
  type LeagueTimelineContext,
  type RiotMatchDto,
  type RiotTimelineDto,
} from "@gc-stats/lol-stats-engine";
import { maybeAutoCompleteMatchFromMaps } from "@/lib/bracket/auto-complete-match";

export interface StoreGameInput {
  /** The series (`matches.id`) this game belongs to. */
  matchId: number;
  /** Game number within the series, 1-based. */
  order: number;
  match: RiotMatchDto;
  /** null after a chronobreak: the summary is still written, the raw timeline rows are not. */
  timeline: RiotTimelineDto | null;
  /** Where the game came from. null when unknown (games entered by hand). */
  source: "leaguepedia" | "riot" | null;
  entrantIdBySide: Record<LeagueSide, number>;
  /** Person for every Riot puuid in the game. Every participant must be mapped. */
  personIdByPuuid: Map<string, number>;
  /** The game being edited: its row is replaced in place, so a manual game becomes the Riot game without a second row. */
  replaceGameId?: number | null;
  championNameById: Map<number, string>;
  /** The role of each participant: inferred from the positions, or the admin's override (resolvePlayerRoles). */
  roleByParticipantId: Map<number, string | null>;
  /** The admin's role overrides by puuid, kept on the game so a re-import keeps them. */
  roleOverrides: Record<string, string | null>;
}

export async function storeGameData(input: StoreGameInput): Promise<{ gameId: number }> {
  const { match, timeline, personIdByPuuid } = input;
  const apiMatchId = match.metadata.matchId;

  const unmapped = match.info.participants.filter((p) => !personIdByPuuid.has(p.puuid));
  if (unmapped.length > 0) {
    throw new Error(`Game ${apiMatchId} has ${unmapped.length} participant(s) without a person; map them before storing`);
  }

  const { games, gamePlayerStats, gameTeamStats, gameDraft, gameFramesRaw, gameEventsRaw } = leagueTablesOf("lol");

  const summaryContext = (gameId: number): LeagueSummaryContext => ({
    gameId,
    order: input.order,
    entrantIdBySide: input.entrantIdBySide,
    personIdByPuuid,
    championNameById: input.championNameById,
    roleByParticipantId: input.roleByParticipantId,
  });

  const timelineContext = (gameId: number): LeagueTimelineContext => ({
    gameId,
    personIdByParticipantId: new Map(match.info.participants.map((p) => [p.participantId, personIdByPuuid.get(p.puuid)!])),
    sideByParticipantId: new Map(match.info.participants.map((p) => [p.participantId, sideForTeamId(p.teamId)])),
  });

  const lanePlayers: LanePlayer[] = match.info.participants.map((p) => ({
    personId: personIdByPuuid.get(p.puuid)!,
    side: sideForTeamId(p.teamId),
    role: input.roleByParticipantId.get(p.participantId) ?? null,
  }));

  // The game row does not need its own id, so its fields come from a first pass.
  const gameFields = {
    ...buildGameSummary(match, summaryContext(0)).game,
    matchId: input.matchId,
    source: input.source,
    roleOverrides: input.roleOverrides,
  };

  const gameId = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${apiMatchId}))`);

    const [byRiotId] = await tx.select({ id: games.id, matchId: games.matchId }).from(games).where(eq(games.apiMatchId, apiMatchId)).limit(1);
    let existing = byRiotId;
    if (input.replaceGameId != null) {
      const [target] = await tx.select({ id: games.id, matchId: games.matchId }).from(games).where(eq(games.id, input.replaceGameId)).limit(1);
      if (!target || target.matchId !== input.matchId) throw new Error(`Game ${input.replaceGameId} is not a game of this series`);
      if (byRiotId && byRiotId.id !== target.id) throw new Error(`Riot match ${apiMatchId} is already attached to another game`);
      existing = target;
    }
    if (existing && existing.matchId !== input.matchId) {
      throw new Error(`Riot match ${apiMatchId} is already attached to another series`);
    }

    let id: number;
    if (existing) {
      id = existing.id;
      await tx.update(games).set(gameFields).where(eq(games.id, id));
      // A re-import is a full replacement of what the game had before.
      await tx.delete(gameEventsRaw).where(eq(gameEventsRaw.gameId, id));
      await tx.delete(gameFramesRaw).where(eq(gameFramesRaw.gameId, id));
      await tx.delete(gameDraft).where(eq(gameDraft.gameId, id));
      await tx.delete(gameTeamStats).where(eq(gameTeamStats.gameId, id));
      await tx.delete(gamePlayerStats).where(eq(gamePlayerStats.gameId, id));
    } else {
      const [inserted] = await tx.insert(games).values(gameFields).returning({ id: games.id });
      id = inserted!.id;
    }

    const summary = buildGameSummary(match, summaryContext(id));
    const rows = buildTimelineRows(timeline, timelineContext(id));

    // Derived stats, written on the summary rows they belong to.
    const laneDiffs = computeLaneDiffs(rows, lanePlayers);
    const firstBlood = computeFirstBlood(rows);
    const firstTower = computeFirstTower(rows);
    const objectiveTimings = computeObjectiveTimings(rows);

    const players = summary.players.map((p) => ({ ...p, ...(p.personId === null ? undefined : laneDiffs.get(p.personId)) }));
    const teams = summary.teams.map((t) => ({
      ...t,
      firstBlood: firstBlood?.side === t.side,
      firstTower: firstTower?.side === t.side,
      objectiveTimings: objectiveTimings[t.side],
    }));

    if (players.length) await tx.insert(gamePlayerStats).values(players);
    if (teams.length) await tx.insert(gameTeamStats).values(teams);
    if (summary.draft.length) await tx.insert(gameDraft).values(summary.draft);
    if (rows.frames.length) await tx.insert(gameFramesRaw).values(rows.frames);
    if (rows.events.length) await tx.insert(gameEventsRaw).values(rows.events);

    return id;
  });

  try {
    await maybeAutoCompleteMatchFromMaps("lol", input.matchId);
  } catch (err) {
    console.warn(`[lol-import] auto-complete failed for match #${input.matchId}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { gameId };
}

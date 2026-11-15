/**
 * GC-Stats - liquipedia-import-status
 *
 * How far each match of a tournament got through the Liquipedia import:
 * nothing done, Riot match ids present but not fetched, or fetched.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
// adminDb: the page must show the import that just ran.
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables, leagueTablesOf, valorantTablesOf } from "@gc-stats/db";
import type { LiquipediaImportStatus } from "@/lib/liquipedia-import-status-types";
import { gameHasSeriesGames, type GameSlug } from "@gc-stats/db/game";

/**
 * League: done when every game of the match has player data (a Riot or Leaguepedia import) and a draft, partial when the
 * match has games but not all of them do, none when it has no games.
 */
async function getLeagueImportStatuses(game: GameSlug, tournamentId: number): Promise<Record<number, LiquipediaImportStatus>> {
  const { matches, stageContainers, stages } = gameTables(game);
  const { games, gamePlayerStats, gameDraft } = leagueTablesOf(game);
  const gameRows = await db
    .select({ id: games.id, matchId: games.matchId })
    .from(games)
    .innerJoin(matches, eq(matches.id, games.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));
  if (gameRows.length === 0) return {};

  const gameIds = gameRows.map((g) => g.id);
  const [withPlayers, withDraft] = await Promise.all([
    db.selectDistinct({ gameId: gamePlayerStats.gameId }).from(gamePlayerStats).where(inArray(gamePlayerStats.gameId, gameIds)),
    db.selectDistinct({ gameId: gameDraft.gameId }).from(gameDraft).where(inArray(gameDraft.gameId, gameIds)),
  ]);
  const players = new Set(withPlayers.map((r) => r.gameId));
  const drafts = new Set(withDraft.map((r) => r.gameId));

  const complete = new Map<number, boolean>();
  for (const row of gameRows) complete.set(row.matchId, (complete.get(row.matchId) ?? true) && players.has(row.id) && drafts.has(row.id));
  return Object.fromEntries([...complete].map(([matchId, isComplete]) => [matchId, isComplete ? "done" : "partial"] as const));
}

export async function getTournamentImportStatuses(game: GameSlug, tournamentId: number): Promise<Record<number, LiquipediaImportStatus>> {
  if (gameHasSeriesGames(game)) return getLeagueImportStatuses(game, tournamentId);
  const { matches, stageContainers, stages } = gameTables(game);
  const { maps, mapPlayerStats } = valorantTablesOf(game);
  const mapRows = await db
    .select({ id: maps.id, matchId: maps.matchId, apiMatchId: maps.apiMatchId, teamAScore: maps.teamAScore, teamBScore: maps.teamBScore })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));

  const withApiId = mapRows.filter((m) => m.apiMatchId);
  const fetchedMapIds = new Set(
    withApiId.length > 0
      ? (
          await db
            .selectDistinct({ mapId: mapPlayerStats.mapId })
            .from(mapPlayerStats)
            .where(inArray(mapPlayerStats.mapId, withApiId.map((m) => m.id)))
        ).map((r) => r.mapId)
      : []
  );

  const byMatch = new Map<number, { withId: number; fetched: number }>();
  for (const map of withApiId) {
    const entry = byMatch.get(map.matchId) ?? { withId: 0, fetched: 0 };
    entry.withId += 1;
    if (fetchedMapIds.has(map.id)) entry.fetched += 1;
    byMatch.set(map.matchId, entry);
  }

  const result: Record<number, LiquipediaImportStatus> = {};
  for (const [matchId, entry] of byMatch) result[matchId] = entry.fetched === entry.withId ? "done" : "partial";
  return result;
}

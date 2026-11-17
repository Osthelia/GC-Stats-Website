/**
 * GC-Stats - admin-player-merge
 *
 * Resolves the mergeable units (recent map stats, tagged news) shown on
 * the player merge picker, feeding actions/admin-player-merge.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables, leagueTablesOf, valorantTablesOf } from "@gc-stats/db";
import { gameHasMaps, gameHasSeriesGames, type GameSlug } from "@gc-stats/db/game";

export type MergeMapStatEntry = {
  statId: number;
  mapId: number;
  entrantId: number;
  mapName: string | null;
  agentName: string | null;
  tournamentId: number;
  tournamentName: string;
  playedAt: string | null;
};

// Caps the merge picker at a career's worth of recent maps rather than loading an unbounded list
// into the page (mirrors getPersonProductionsPage's pageSize: 1000).
const MAP_STATS_MERGE_LIMIT = 1000;

/** Most recent `map_player_stats` rows this person has recorded, one per map, capped at {@link MAP_STATS_MERGE_LIMIT} — the merge unit for "match participation" (see mergePlayers' mergeStats). */
export async function getMergeablePlayerMapStats(game: GameSlug, personId: number): Promise<MergeMapStatEntry[]> {
  // Only Valorant has maps; a League player's games come from getMergeablePlayerGameStats.
  if (!gameHasMaps(game)) return [];
  const { matches, stageContainers, stages, tournaments } = gameTables(game);
  const { mapPlayerStats, maps } = valorantTablesOf(game);
  const rows = await db
    .select({
      statId: mapPlayerStats.id,
      mapId: maps.id,
      entrantId: mapPlayerStats.entrantId,
      mapName: maps.mapName,
      agentName: mapPlayerStats.agentName,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      startedAt: maps.startedAt,
      scheduledAt: matches.scheduledAt,
    })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(mapPlayerStats.personId, personId))
    .orderBy(desc(maps.id))
    .limit(MAP_STATS_MERGE_LIMIT);

  return rows.map((r) => ({
    statId: r.statId,
    mapId: r.mapId,
    entrantId: r.entrantId,
    mapName: r.mapName,
    agentName: r.agentName,
    tournamentId: r.tournamentId,
    tournamentName: r.tournamentName,
    playedAt: (r.startedAt ?? r.scheduledAt)?.toISOString() ?? null,
  }));
}

export type MergeGameStatEntry = {
  statId: number;
  gameId: number;
  order: number;
  entrantId: number;
  championName: string;
  role: string | null;
  tournamentId: number;
  tournamentName: string;
  playedAt: string | null;
};

/** Most recent `lol_game_player_stats` rows this person has recorded, one per game, capped at {@link MAP_STATS_MERGE_LIMIT}: the merge unit for a League player's games (see mergePlayers' gameStats). */
export async function getMergeablePlayerGameStats(game: GameSlug, personId: number): Promise<MergeGameStatEntry[]> {
  if (!gameHasSeriesGames(game)) return [];
  const { matches, stageContainers, stages, tournaments } = gameTables(game);
  const { games, gamePlayerStats } = leagueTablesOf(game);
  const rows = await db
    .select({
      statId: gamePlayerStats.id,
      gameId: games.id,
      order: games.order,
      entrantId: gamePlayerStats.entrantId,
      championName: gamePlayerStats.championName,
      role: gamePlayerStats.role,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      startedAt: games.startedAt,
      scheduledAt: matches.scheduledAt,
    })
    .from(gamePlayerStats)
    .innerJoin(games, eq(games.id, gamePlayerStats.gameId))
    .innerJoin(matches, eq(matches.id, games.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(gamePlayerStats.personId, personId))
    .orderBy(desc(games.id))
    .limit(MAP_STATS_MERGE_LIMIT);

  return rows.map((r) => ({
    statId: r.statId,
    gameId: r.gameId,
    order: r.order,
    entrantId: r.entrantId,
    championName: r.championName,
    role: r.role,
    tournamentId: r.tournamentId,
    tournamentName: r.tournamentName,
    playedAt: (r.startedAt ?? r.scheduledAt)?.toISOString() ?? null,
  }));
}

export type MergeNewsEntry = { newsId: number; title: string };

/** `news_relations` rows tagging this person — merge unit keyed by `newsId`, mirrors admin-team-merge.ts::getMergeableTeamNews. */
export async function getMergeablePlayerNews(game: GameSlug, personId: number): Promise<MergeNewsEntry[]> {
  const { newsRelations, news } = gameTables(game);
  const rows = await db
    .select({ newsId: news.id, title: news.title })
    .from(newsRelations)
    .innerJoin(news, eq(news.id, newsRelations.newsId))
    .where(and(eq(newsRelations.relatableType, "person"), eq(newsRelations.relatableId, personId)))
    .orderBy(desc(news.id));

  return rows;
}

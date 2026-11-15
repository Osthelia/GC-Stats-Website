/**
 * GC-Stats - liquipedia-lol-match-data
 *
 * Loads the games of League matches and builds their `{{Match}}` wikicode,
 * batched like the Valorant loader so a whole stage costs a fixed number of
 * queries. Champions come from the player data only; the draft only gives
 * the bans.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { leagueTablesOf } from "@gc-stats/db";
import { loadMatchExportBases, type LiquipediaMatchWikicode } from "@/lib/liquipedia-match-data";
import { TEAM_SLOTS, banSlotOfStep, buildLolMatchWikicode, championsInLaneOrder, type WikicodeLolBuildGame } from "@/lib/liquipedia-lol-match-wikicode";
import type { LeagueSide } from "@gc-stats/lol-stats-engine";
import type { GameSlug } from "@gc-stats/db/game";

async function buildWikicodes(game: GameSlug, matchIds: number[]): Promise<LiquipediaMatchWikicode[]> {
  const { games, gameTeamStats, gamePlayerStats, gameDraft } = leagueTablesOf(game);
  const bases = await loadMatchExportBases(game, matchIds);
  if (bases.length === 0) return [];

  const gameRows = await db
    .select({ id: games.id, matchId: games.matchId, winnerEntrantId: games.winnerEntrantId, durationSeconds: games.durationSeconds, draftBlueEntrantId: games.draftBlueEntrantId })
    .from(games)
    .where(inArray(games.matchId, matchIds))
    .orderBy(asc(games.matchId), asc(games.order));
  const gameIds = gameRows.map((g) => g.id);
  const [sideRows, playerRows, banRows] = gameIds.length
    ? await Promise.all([
        db.select({ gameId: gameTeamStats.gameId, entrantId: gameTeamStats.entrantId, side: gameTeamStats.side }).from(gameTeamStats).where(inArray(gameTeamStats.gameId, gameIds)),
        db.select({ gameId: gamePlayerStats.gameId, entrantId: gamePlayerStats.entrantId, role: gamePlayerStats.role, championName: gamePlayerStats.championName }).from(gamePlayerStats).where(inArray(gamePlayerStats.gameId, gameIds)),
        db
          .select({ gameId: gameDraft.gameId, entrantId: gameDraft.entrantId, championName: gameDraft.championName, order: gameDraft.order })
          .from(gameDraft)
          .where(and(inArray(gameDraft.gameId, gameIds), eq(gameDraft.type, "ban"), isNotNull(gameDraft.order))),
      ])
    : [[], [], []];

  return bases.map(({ summary, bestOf, patch, isForfeit, winnerEntrantId, entrantAId, entrantBId, opponent1, opponent2, twitch, youtube }) => {
    const buildGame = (row: (typeof gameRows)[number]): WikicodeLolBuildGame => {
      const teamOf = (entrantId: number | null) => {
        const champions = entrantId === null ? [] : championsInLaneOrder(playerRows.filter((p) => p.gameId === row.id && p.entrantId === entrantId));
        // A ban sits in its slot by its draft step, whoever the team is.
        const bans = Array.from({ length: TEAM_SLOTS }, () => "");
        for (const ban of banRows) {
          const slot = ban.order === null ? null : banSlotOfStep(ban.order);
          if (ban.gameId === row.id && ban.entrantId === entrantId && slot !== null) bans[slot - 1] = ban.championName;
        }
        return { champions, bans };
      };
      // The side the import recorded, else the blue team of a hand-entered draft.
      const teamASide = sideRows.find((s) => s.gameId === row.id && s.entrantId === entrantAId)?.side ?? null;
      const team1Side: LeagueSide | null =
        teamASide === "blue" || teamASide === "red"
          ? teamASide
          : row.draftBlueEntrantId === null || entrantAId === null
            ? null
            : row.draftBlueEntrantId === entrantAId
              ? "blue"
              : "red";
      const team1 = teamOf(entrantAId);
      const team2 = teamOf(entrantBId);
      return {
        team1Side,
        winner: row.winnerEntrantId === null ? null : row.winnerEntrantId === entrantAId ? 1 : row.winnerEntrantId === entrantBId ? 2 : null,
        durationSeconds: row.durationSeconds,
        team1Champions: team1.champions,
        team2Champions: team2.champions,
        team1Bans: team1.bans,
        team2Bans: team2.bans,
      };
    };

    const forfeitWinner = isForfeit && winnerEntrantId !== null ? (winnerEntrantId === entrantAId ? 1 : winnerEntrantId === entrantBId ? 2 : null) : null;
    return {
      ...summary,
      wikicode: buildLolMatchWikicode({
        scheduledAt: summary.scheduledAt,
        bestOf,
        completed: summary.status === "completed",
        forfeitWinner,
        opponent1,
        opponent2,
        twitch,
        youtube,
        patch,
        games: gameRows.filter((g) => g.matchId === summary.matchId).map(buildGame),
      }),
    };
  });
}

export async function getLiquipediaLolMatchWikicode(game: GameSlug, matchId: number): Promise<LiquipediaMatchWikicode | null> {
  const [result] = await buildWikicodes(game, [matchId]);
  return result ?? null;
}

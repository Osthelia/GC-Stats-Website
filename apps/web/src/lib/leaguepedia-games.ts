/**
 * GC-Stats - leaguepedia-games
 *
 * The game list of a LoL tournament, from Leaguepedia's Cargo tables: one query for the base page and
 * every page under it, then the list replaces the tournament's rows in `lol_leaguepedia_games`. The
 * field names and the left join follow leaguepedia-v5-export, checked against its recorded rows.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { lolLeaguepediaGames, lolLeaguepediaTournaments } from "@gc-stats/db";
import { db } from "@gc-stats/db/client";
import { fetchLeaguepediaCargo, type CargoQuery, type CargoRow, type LeaguepediaResult } from "./leaguepedia-client";

export type LeaguepediaGameRow = Omit<typeof lolLeaguepediaGames.$inferInsert, "id" | "tournamentId">;

/** The base page and every page under it. Cargo's LIKE wildcards in the base page are escaped. */
export function buildGameListQuery(overviewPage: string): CargoQuery {
  return {
    tables: "MatchScheduleGame=MSG,MatchSchedule=MS,PostgameJsonMetadata=PJM",
    joinOn: "MSG.MatchId=MS.MatchId,MSG.RiotPlatformGameId=PJM.RiotPlatformGameId",
    fields: [
      "MSG.GameId=GameId",
      "MSG.MatchId=MatchId",
      "MSG.OverviewPage=OverviewPage",
      "MSG.N_GameInMatch=GameInMatch",
      "MSG.Blue=Blue",
      "MSG.Red=Red",
      "MSG.Winner=Winner",
      "MSG.IsRemake=IsRemake",
      "MSG.IsChronobreak=IsChronobreak",
      "MSG.RiotPlatformGameId=RiotPlatformGameId",
      "MS.Team1=Team1",
      "MS.Team2=Team2",
      "MS.DateTime_UTC=DateTimeUtc",
      "PJM.StatsPage=StatsPage",
      "PJM.RiotVersion=RiotVersion",
    ].join(", "),
    where: `MSG.OverviewPage = ${cargoString(overviewPage)} OR MSG.OverviewPage LIKE ${cargoString(`${escapeLike(overviewPage)}/%`)}`,
    orderBy: "MS.DateTime_UTC, MSG.N_GameInMatch",
  };
}

/** One game row from a list row. A game without V5 JSON keeps its row, with `hasData` false. */
export function gameRowFromCargo(row: CargoRow): LeaguepediaGameRow {
  const field = (name: string): string => row[name] ?? "";
  return {
    leaguepediaGameId: field("GameId"),
    leaguepediaMatchId: field("MatchId"),
    overviewPage: field("OverviewPage"),
    gameInMatch: Number(field("GameInMatch")),
    team1: field("Team1") || null,
    team2: field("Team2") || null,
    blue: field("Blue") || null,
    red: field("Red") || null,
    winner: field("Winner") === "1" ? 1 : field("Winner") === "2" ? 2 : null,
    playedAt: parseCargoDate(field("DateTimeUtc")),
    riotMatchId: field("RiotPlatformGameId") || null,
    riotVersion: field("RiotVersion") || null,
    // The same test as the exporter's gameStatus: a V5 stats page exists for the game.
    hasData: field("RiotVersion") === "5" && field("StatsPage") !== "",
    isRemake: field("IsRemake") === "1",
    isChronobreak: field("IsChronobreak") === "1",
  };
}

/** Reads the tournament's game list from Leaguepedia and replaces its rows. The result is the number of games. */
export async function refreshGameList(tournamentId: number, overviewPage: string): Promise<LeaguepediaResult<number>> {
  const result = await fetchLeaguepediaCargo(buildGameListQuery(overviewPage));
  if (!result.ok) return result;

  const games = result.data.map(gameRowFromCargo);
  await replaceGameList(tournamentId, overviewPage, games);
  return { ok: true, data: games.length };
}

/** One transaction: the tournament's link is set and stamped, and its game rows are replaced. */
async function replaceGameList(tournamentId: number, overviewPage: string, games: LeaguepediaGameRow[]): Promise<void> {
  const gamesFetchedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(lolLeaguepediaTournaments)
      .values({ tournamentId, overviewPage, gamesFetchedAt })
      .onConflictDoUpdate({ target: lolLeaguepediaTournaments.tournamentId, set: { overviewPage, gamesFetchedAt } });
    await tx.delete(lolLeaguepediaGames).where(eq(lolLeaguepediaGames.tournamentId, tournamentId));
    // Drizzle rejects an empty insert, and a tournament can have no games yet.
    if (games.length > 0) await tx.insert(lolLeaguepediaGames).values(games.map((game) => ({ ...game, tournamentId })));
  });
}

/** Cargo dates are UTC, written "2026-08-22 10:00:00". Empty or unreadable values are null. */
function parseCargoDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A double-quoted Cargo string. Backslashes are doubled first, then quotes escaped. */
export function cargoString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** For a LIKE pattern: `%` and `_` match anything, so each is escaped with a backslash. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * GC-Stats - stats-aggregate-sql
 *
 * Aggregates `map_player_stats` rows (one per player per map) into
 * `StatRow`s, in Postgres so the stats pages never load every per map row
 * (and its JSONB) into memory. `aggregateLeaguePlayerStatsSql` does the same
 * for LoL: `lol_game_player_stats` rows (one per player per game) into
 * `LeagueStatRow`s.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, isNotNull, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { leagueTablesOf, valorantTables } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";
import type { LeagueStatRow, StatRow } from "@/lib/stats-aggregate";

/** A `select map_player_stats.id ...` subquery picking the rows to aggregate. */
export type MapPlayerStatsScope = SQLWrapper;

/** Treats a non object JSONB value as empty, jsonb_each would throw on it. */
export function jsonObject(column: PgColumn) {
  return sql`case when jsonb_typeof(${column}) = 'object' then ${column} else '{}'::jsonb end`;
}

function jsonKey(column: PgColumn, key: string) {
  return sql`coalesce((${column} ->> ${key})::numeric, 0)`;
}

export function playerRoundsPlayedSql() {
  const { mapPlayerStats, mapTeamRoundSummary } = valorantTables;
  return sql<number>`(
  select coalesce(sum(${mapTeamRoundSummary.roundsPlayed}), 0)
  from ${mapTeamRoundSummary}
  where ${mapTeamRoundSummary.mapId} = ${mapPlayerStats.mapId} and ${mapTeamRoundSummary.entrantId} = ${mapPlayerStats.entrantId}
)`;
}

type TotalsRow = StatRow["totals"] & { groupKey: string; mapsPlayed: number; roundsPlayed: number };

export const sumFloat = (expr: SQL | PgColumn) => sql<number>`coalesce(sum(${expr}), 0)::float8`;

export async function aggregateMapPlayerStatsSql(scope: MapPlayerStatsScope, groupBy: "agentName" | "personId"): Promise<StatRow[]> {
  const { mapPlayerStats } = valorantTables;
  const groupKey = groupBy === "agentName" ? sql<string>`coalesce(${mapPlayerStats.agentName}, '?')` : sql<string>`coalesce(${mapPlayerStats.personId}::text, '?')`;
  const inScope = inArray(mapPlayerStats.id, scope);
  const clutchSum = (field: "won" | "total") =>
    sql`(select coalesce(sum((c.value ->> ${field})::numeric), 0) from jsonb_each(${jsonObject(mapPlayerStats.clutches)}) as c)`;

  const totalsQuery = db
      .select({
        groupKey,
        mapsPlayed: sql<number>`count(*)::int`,
        roundsPlayed: sql<number>`coalesce(sum(${playerRoundsPlayedSql()}), 0)::int`,
        kills: sumFloat(mapPlayerStats.kills),
        deaths: sumFloat(mapPlayerStats.deaths),
        assists: sumFloat(mapPlayerStats.assists),
        acs: sumFloat(mapPlayerStats.acs),
        adr: sumFloat(mapPlayerStats.adr),
        kastPercentage: sumFloat(mapPlayerStats.kastPercentage),
        firstKills: sumFloat(mapPlayerStats.firstKills),
        firstDeaths: sumFloat(mapPlayerStats.firstDeaths),
        headshotPercentage: sumFloat(mapPlayerStats.headshotPercentage),
        tradeKills: sumFloat(mapPlayerStats.tradeKills),
        tradedDeaths: sumFloat(mapPlayerStats.tradedDeaths),
        fallDeaths: sumFloat(mapPlayerStats.fallDeaths),
        ability1Kills: sumFloat(jsonKey(mapPlayerStats.abilityKills, "ability1")),
        ability2Kills: sumFloat(jsonKey(mapPlayerStats.abilityKills, "ability2")),
        grenadeKills: sumFloat(jsonKey(mapPlayerStats.abilityKills, "grenade")),
        ultimateKills: sumFloat(jsonKey(mapPlayerStats.abilityKills, "ultimate")),
        multi2k: sumFloat(jsonKey(mapPlayerStats.multikills, "2k")),
        multi3k: sumFloat(jsonKey(mapPlayerStats.multikills, "3k")),
        multi4k: sumFloat(jsonKey(mapPlayerStats.multikills, "4k")),
        multi5k: sumFloat(jsonKey(mapPlayerStats.multikills, "5k")),
        clutchesWon: sumFloat(clutchSum("won")),
        clutchesPlayed: sumFloat(clutchSum("total")),
        ratingWeighted: sumFloat(sql`${mapPlayerStats.rating} * ${mapPlayerStats.ratingRounds}`),
        ratingRounds: sumFloat(sql`case when ${mapPlayerStats.rating} is not null then ${mapPlayerStats.ratingRounds} end`),
      })
      .from(mapPlayerStats)
      .where(inScope)
      .groupBy(groupKey);
  const weaponsQuery = db.execute<{ group_key: string; weapon: string; kills: number }>(sql`
      select ${groupKey} as group_key, w.key as weapon, sum(w.value::numeric)::float8 as kills
      from ${mapPlayerStats}
      cross join lateral jsonb_each_text(${jsonObject(mapPlayerStats.weaponKills)}) as w
      where ${inScope}
      group by 1, 2
    `);
  // Explicit row type: drizzle's inference gives up on this many computed fields.
  const [totalRows, weaponRows]: [TotalsRow[], Awaited<typeof weaponsQuery>] = await Promise.all([totalsQuery, weaponsQuery]);

  const weaponsByGroup = new Map<string, Record<string, number>>();
  for (const w of weaponRows.rows) {
    const weapons = weaponsByGroup.get(w.group_key) ?? {};
    weapons[w.weapon] = w.kills;
    weaponsByGroup.set(w.group_key, weapons);
  }

  return totalRows.map((row) => {
    const { groupKey: key, mapsPlayed, roundsPlayed, ...totals } = row;
    return { groupKey: key, mapsPlayed, roundsPlayed, totals, weaponKills: weaponsByGroup.get(key) ?? {} };
  });
}

/** The average over the rows that have a value: a lane diff is null in a game without a lane opponent, and so is the average of none. */
const avgFloat = (column: PgColumn) => sql<number | null>`avg(${column})::float8`;

/** No lane opponent in any game: NaN, which the stats table shows as "–" and sorts last. */
const orNaN = (average: number | null) => average ?? NaN;

/** The alias of the player stats in the subquery for a team's kills. */
const TEAMMATE = "teammate";

/**
 * The players of `scope` (a `select lol_game_player_stats.id ...` subquery), one row per person or per champion.
 * Every row counts for the games and wins; the numbers come only from the rows with stats (`has_stats`), so a manual
 * lineup without a scoreboard never lowers an average. By champion, a lineup row without a known champion is left out.
 */
export async function aggregateLeaguePlayerStatsSql(game: GameSlug, scope: SQLWrapper, groupBy: "championName" | "personId"): Promise<LeagueStatRow[]> {
  const { games, gamePlayerStats, gameTeamStats } = leagueTablesOf(game);
  const withStats = (expr: SQL | PgColumn) => sql`case when ${gamePlayerStats.hasStats} then ${expr} end`;
  // Gold, damage and vision can be missing from a manual scoreboard: their per minute numbers use only the games that have them.
  const minutesWith = (column: PgColumn) => sumFloat(sql`case when ${gamePlayerStats.hasStats} and ${column} is not null then ${games.durationSeconds} / 60.0 end`);
  // A manual scoreboard has no team stats: its team's kills are the kills of the team's players in that game.
  const teammate = alias(gamePlayerStats, TEAMMATE);
  // Inside a raw sql template an alias renders as its bare name, so the subquery names the table and its alias itself.
  const teamKillsOfGame = sql`coalesce(${gameTeamStats.kills}, (select sum(${teammate.kills}) from ${gamePlayerStats} as ${sql.identifier(TEAMMATE)} where ${teammate.gameId} = ${gamePlayerStats.gameId} and ${teammate.entrantId} = ${gamePlayerStats.entrantId} and ${teammate.hasStats}))`;

  const rows = await db
    .select({
      groupKey: groupBy === "personId" ? sql<string>`coalesce(${gamePlayerStats.personId}::text, '?')` : sql<string>`${gamePlayerStats.championName}`,
      mapsPlayed: sql<number>`count(*)::int`,
      statGames: sql<number>`count(*) filter (where ${gamePlayerStats.hasStats})::int`,
      wins: sumFloat(sql`case when ${games.winnerEntrantId} = ${gamePlayerStats.entrantId} then 1 else 0 end`),
      kills: sumFloat(withStats(gamePlayerStats.kills)),
      deaths: sumFloat(withStats(gamePlayerStats.deaths)),
      assists: sumFloat(withStats(gamePlayerStats.assists)),
      teamKills: sumFloat(withStats(teamKillsOfGame)),
      cs: sumFloat(withStats(gamePlayerStats.cs)),
      gold: sumFloat(withStats(gamePlayerStats.gold)),
      damage: sumFloat(withStats(gamePlayerStats.damage)),
      vision: sumFloat(withStats(gamePlayerStats.vision)),
      minutes: sumFloat(withStats(sql`${games.durationSeconds} / 60.0`)),
      goldMinutes: minutesWith(gamePlayerStats.gold),
      damageMinutes: minutesWith(gamePlayerStats.damage),
      visionMinutes: minutesWith(gamePlayerStats.vision),
      goldDiff10: avgFloat(gamePlayerStats.goldDiff10),
      goldDiff15: avgFloat(gamePlayerStats.goldDiff15),
      xpDiff10: avgFloat(gamePlayerStats.xpDiff10),
      xpDiff15: avgFloat(gamePlayerStats.xpDiff15),
      csDiff10: avgFloat(gamePlayerStats.csDiff10),
      csDiff15: avgFloat(gamePlayerStats.csDiff15),
    })
    .from(gamePlayerStats)
    .innerJoin(games, eq(games.id, gamePlayerStats.gameId))
    .leftJoin(gameTeamStats, and(eq(gameTeamStats.gameId, gamePlayerStats.gameId), eq(gameTeamStats.entrantId, gamePlayerStats.entrantId)))
    .where(and(inArray(gamePlayerStats.id, scope), groupBy === "championName" ? isNotNull(gamePlayerStats.championName) : undefined))
    .groupBy(groupBy === "personId" ? gamePlayerStats.personId : gamePlayerStats.championName);

  return rows.map(({ groupKey, mapsPlayed, goldDiff10, goldDiff15, xpDiff10, xpDiff15, csDiff10, csDiff15, ...totals }) => ({
    groupKey,
    mapsPlayed,
    totals,
    averages: {
      goldDiff10: orNaN(goldDiff10),
      goldDiff15: orNaN(goldDiff15),
      xpDiff10: orNaN(xpDiff10),
      xpDiff15: orNaN(xpDiff15),
      csDiff10: orNaN(csDiff10),
      csDiff15: orNaN(csDiff15),
    },
  }));
}

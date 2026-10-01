/**
 * GC-Stats - stats-aggregate-sql
 *
 * Aggregates `map_player_stats` rows (one per player per map) into
 * `StatRow`s, in Postgres so the stats pages never load every per map row
 * (and its JSONB) into memory.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { inArray, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@gc-stats/db/client";
import { mapPlayerStats } from "@gc-stats/db";
import type { StatRow } from "@/lib/stats-aggregate";

/** A `select map_player_stats.id ...` subquery picking the rows to aggregate. */
export type MapPlayerStatsScope = SQLWrapper;

/** Treats a non object JSONB value as empty, jsonb_each would throw on it. */
function jsonObject(column: PgColumn) {
  return sql`case when jsonb_typeof(${column}) = 'object' then ${column} else '{}'::jsonb end`;
}

function jsonKey(column: PgColumn, key: string) {
  return sql`coalesce((${column} ->> ${key})::numeric, 0)`;
}

type TotalsRow = StatRow["totals"] & { groupKey: string; mapsPlayed: number };

const sumFloat = (expr: SQL | PgColumn) => sql<number>`coalesce(sum(${expr}), 0)::float8`;

export async function aggregateMapPlayerStatsSql(scope: MapPlayerStatsScope, groupBy: "agentName" | "personId"): Promise<StatRow[]> {
  const groupKey = groupBy === "agentName" ? sql<string>`coalesce(${mapPlayerStats.agentName}, '?')` : sql<string>`coalesce(${mapPlayerStats.personId}::text, '?')`;
  const inScope = inArray(mapPlayerStats.id, scope);
  const clutchSum = (field: "won" | "total") =>
    sql`(select coalesce(sum((c.value ->> ${field})::numeric), 0) from jsonb_each(${jsonObject(mapPlayerStats.clutches)}) as c)`;

  const totalsQuery = db
      .select({
        groupKey,
        mapsPlayed: sql<number>`count(*)::int`,
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
    const { groupKey: key, mapsPlayed, ...totals } = row;
    return { groupKey: key, mapsPlayed, totals, weaponKills: weaponsByGroup.get(key) ?? {} };
  });
}

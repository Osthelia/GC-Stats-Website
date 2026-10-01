/**
 * GC-Stats — 10-game-stats-aggregated
 *
 * V1 to V2 migration step: migrates per-map player stats, merging V1's
 * separate core and advanced stats tables into one map_player_stats row.
 * Maps with no advanced stats row get zeroed clutch/multikill/trade fields.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db, v1, pgRaw } from "./connection";
import { getMappedId, tryMappedId, preloadEntityType, batchInsert } from "./id-map";
import { entrantKey } from "./05-entrants-matches";
import { mapPlayerStats } from "../../src/schema";

// V1 splits per-map player stats across two tables (game_player_stats +
// game_player_advanced_stats, joined 1:1 on game_map_id+player_id) — V2
// merges them into one map_player_stats row (see DATABASES.MD §4.2). Advanced
// stats only exist for a subset of maps (18.2k of 272k core rows, per the
// live count) — a row without a matching advanced row just gets zeroed
// clutch/multikill/trade/roundTypeSplits fields, matching the column
// defaults on map_player_stats.
function clutchesJson(adv: any | undefined) {
  if (!adv) return {};
  const out: Record<string, { won: number; total: number }> = {};
  for (let n = 1; n <= 5; n++) {
    const won = adv[`clutch_1v${n}_won`] ?? 0;
    const total = adv[`clutch_1v${n}_total`] ?? 0;
    if (total > 0) out[`1v${n}`] = { won, total };
  }
  return out;
}

function multikillsJson(adv: any | undefined) {
  if (!adv) return {};
  return {
    "2k": adv.multikill_2k ?? 0,
    "3k": adv.multikill_3k ?? 0,
    "4k": adv.multikill_4k ?? 0,
    "5k": adv.multikill_5k ?? 0,
  };
}

function roundTypeSplitsJson(adv: any | undefined) {
  if (!adv) return {};
  return {
    pistol: { won: adv.pistol_won ?? 0, played: adv.pistol_played ?? 0 },
    eco: { won: adv.eco_won ?? 0, played: adv.eco_played ?? 0 },
    force: { won: adv.force_won ?? 0, played: adv.force_played ?? 0 },
    fullBuy: { won: adv.full_buy_won ?? 0, played: adv.full_buy_played ?? 0 },
    postPlant: { won: adv.post_plant_won ?? 0, played: adv.post_plant_played ?? 0 },
    atk: { rounds: adv.atk_rounds ?? 0, roundsWon: adv.atk_rounds_won ?? 0, kills: adv.atk_kills ?? 0, kast: adv.atk_kast_percentage ?? "0" },
    def: { rounds: adv.def_rounds ?? 0, roundsWon: adv.def_rounds_won ?? 0, kills: adv.def_kills ?? 0, kast: adv.def_kast_percentage ?? "0" },
  };
}

export async function migrateMapPlayerStats() {
  await preloadEntityType("map");
  await preloadEntityType("player");
  await preloadEntityType("entrant");
  const [rows] = await v1.query<any[]>(
    `SELECT id, tournament_id, game_map_id, player_id, team_id, agent_name, val_name,
            kills, deaths, assists, acs, adr, kast_percentage,
            first_kills, first_deaths, headshot_percentage
     FROM game_player_stats`
  );
  const [advancedRows] = await v1.query<any[]>(`SELECT * FROM game_player_advanced_stats`);
  const advancedByKey = new Map<string, any>(
    (advancedRows as any[]).map((a) => [`${a.game_map_id}:${a.player_id}`, a]),
  );

  const { created, skipped, invalid } = await batchInsert(
    "map_player_stats",
    rows as any[],
    (row) => row.id,
    (row) => {
      const mapId = tryMappedId("map", row.game_map_id);
      const entrantId = row.team_id ? tryMappedId("entrant", entrantKey(row.tournament_id, row.team_id)) : undefined;
      if (!mapId || !entrantId) return null;
      const adv = advancedByKey.get(`${row.game_map_id}:${row.player_id}`);
      return {
        mapId,
        personId: row.player_id ? tryMappedId("player", row.player_id) ?? null : null,
        entrantId,
        agentName: row.agent_name,
        valName: row.val_name,
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        acs: row.acs,
        adr: row.adr,
        kastPercentage: row.kast_percentage,
        firstKills: row.first_kills,
        firstDeaths: row.first_deaths,
        headshotPercentage: row.headshot_percentage,
        clutches: clutchesJson(adv),
        multikills: multikillsJson(adv),
        tradeKills: adv?.trade_kills ?? 0,
        tradedDeaths: adv?.traded_deaths ?? 0,
        roundTypeSplits: roundTypeSplitsJson(adv),
        abilityKills: {}, // not tracked in V1
        fallDeaths: 0, // backfilled below from map_round_kills_raw (damage_type = 'Fall')
        weaponKills: {}, // backfilled below from map_round_kills_raw
      };
    },
    (tx, values) => tx.insert(mapPlayerStats).values(values as any).returning({ id: mapPlayerStats.id }),
    1000,
  );
  console.log(`map_player_stats: ${created} created, ${skipped} already migrated, ${invalid} unresolved`);

  // fallDeaths/weaponKills aren't in V1's aggregate tables but ARE derivable
  // from the raw kills layer migrated in phase 09 — recomputed in full every
  // run (cheap relative to the row counts here, and avoids tracking a third
  // idempotence key for a value that's just a function of already-migrated
  // rows).
  await pgRaw.query(`
    WITH weapon_counts AS (
      SELECT mr.map_id, mrk.killer_person_id AS person_id, mrk.weapon, COUNT(*)::int AS cnt
      FROM map_round_kills_raw mrk
      JOIN map_rounds_raw mr ON mr.id = mrk.map_round_id
      WHERE mrk.killer_person_id IS NOT NULL AND mrk.weapon IS NOT NULL
      GROUP BY mr.map_id, mrk.killer_person_id, mrk.weapon
    ), agg AS (
      SELECT map_id, person_id, jsonb_object_agg(weapon, cnt) AS kills_json
      FROM weapon_counts
      GROUP BY map_id, person_id
    )
    UPDATE map_player_stats mps
    SET weapon_kills = agg.kills_json
    FROM agg
    WHERE mps.map_id = agg.map_id AND mps.person_id = agg.person_id;
  `);
  await pgRaw.query(`
    WITH fall_counts AS (
      SELECT mr.map_id, mrk.victim_person_id AS person_id, COUNT(*)::int AS cnt
      FROM map_round_kills_raw mrk
      JOIN map_rounds_raw mr ON mr.id = mrk.map_round_id
      WHERE mrk.damage_type = 'Fall'
      GROUP BY mr.map_id, mrk.victim_person_id
    )
    UPDATE map_player_stats mps
    SET fall_deaths = fall_counts.cnt
    FROM fall_counts
    WHERE mps.map_id = fall_counts.map_id AND mps.person_id = fall_counts.person_id;
  `);
  console.log("map_player_stats: weaponKills/fallDeaths backfilled from raw kills");
}

// map_team_round_summary has no V1 source table (V1 computes this on the fly
// from game_map_rounds) and no per-legacy-row idempotence key — it's a pure
// aggregate of map_rounds_raw (already migrated in phase 09), so it's fully
// recomputed every run: wipe, then re-derive from current map_rounds_raw.
export async function migrateMapTeamRoundSummary() {
  await pgRaw.query(`DELETE FROM map_team_round_summary`);
  await pgRaw.query(`
    INSERT INTO map_team_round_summary (map_id, entrant_id, side, rounds_played, rounds_won)
    SELECT map_id, entrant_id, side,
           COUNT(*)::int AS rounds_played,
           SUM(CASE WHEN winning_entrant_id = entrant_id THEN 1 ELSE 0 END)::int AS rounds_won
    FROM (
      SELECT map_id, atk_entrant_id AS entrant_id, 'atk' AS side, winning_entrant_id
      FROM map_rounds_raw WHERE atk_entrant_id IS NOT NULL
      UNION ALL
      SELECT map_id, def_entrant_id AS entrant_id, 'def' AS side, winning_entrant_id
      FROM map_rounds_raw WHERE def_entrant_id IS NOT NULL
    ) sides
    GROUP BY map_id, entrant_id, side;
  `);
  const { rows } = await pgRaw.query(`SELECT COUNT(*)::int AS n FROM map_team_round_summary`);
  console.log(`map_team_round_summary: ${rows[0].n} rows (fully recomputed)`);
}

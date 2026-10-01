/**
 * GC-Stats — backfill-loadout-value
 *
 * One-off backfill for map_round_player_loadouts_raw.loadout_value: the
 * original migration (09-game-maps-rounds.ts::migrateMapRoundPlayerLoadouts)
 * skipped this V1 column and wrote NULL, though it's what MatchStatsService's
 * economy-tier classification keys on. Fixed at the source for future runs;
 * this backfills already-migrated rows via the existing migration_id_map
 * (entityType "map_round_loadout").
 *
 * Idempotent: only rewrites rows, never inserts, safe to run again.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { v1, pgRaw, closeConnections } from "./connection";
import { db } from "./connection";
import { migrationIdMap } from "../../src/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Loading V1 loadout_value values...");
  const [rows] = await v1.query<any[]>(`SELECT id, loadout_value FROM game_map_round_player_stats`);
  console.log(`V1 rows: ${rows.length}`);

  const idMapRows = await db.query.migrationIdMap.findMany({ where: eq(migrationIdMap.entityType, "map_round_loadout") });
  const legacyToNew = new Map(idMapRows.map((r) => [r.legacyId, r.newId]));
  console.log(`migration_id_map rows for map_round_loadout: ${idMapRows.length}`);

  const pairs: { newId: number; loadoutValue: number }[] = [];
  for (const row of rows as any[]) {
    if (row.loadout_value == null) continue;
    const newId = legacyToNew.get(row.id);
    if (newId == null) continue;
    pairs.push({ newId, loadoutValue: row.loadout_value });
  }
  console.log(`Rows to backfill: ${pairs.length}`);

  const chunkSize = 1000;
  let updated = 0;
  for (let i = 0; i < pairs.length; i += chunkSize) {
    const chunk = pairs.slice(i, i + chunkSize);
    const values = chunk.map((_, j) => `($${j * 2 + 1}::bigint, $${j * 2 + 2}::int)`).join(",");
    const params = chunk.flatMap((c) => [c.newId, c.loadoutValue]);
    await pgRaw.query(
      `UPDATE map_round_player_loadouts_raw AS t
       SET loadout_value = v.loadout_value
       FROM (VALUES ${values}) AS v(id, loadout_value)
       WHERE t.id = v.id`,
      params,
    );
    updated += chunk.length;
    if (updated % 20000 === 0) console.log(`  ${updated}/${pairs.length}...`);
  }
  console.log(`Backfilled ${updated} rows.`);

  await closeConnections();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * GC-Stats — 00-reset-demo-data
 *
 * One-time cleanup before the V1 to V2 migration: wipes the fake/demo data
 * seeded by earlier seed scripts so the real V1 dataset doesn't end up mixed
 * with placeholder entries. TRUNCATE ... CASCADE takes care of every
 * dependent table regardless of each FK's own onDelete setting. Does NOT
 * touch users/auth or finance_entries.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import "dotenv/config";
import { pgRaw, closeConnections } from "./connection";

async function main() {
  await pgRaw.query(`
    TRUNCATE TABLE
      teams, people, organizations, tournaments,
      news_authors, point_types,
      migration_id_map
    RESTART IDENTITY CASCADE
  `);
  console.log("Demo data wiped.");
  await closeConnections();
}

main();

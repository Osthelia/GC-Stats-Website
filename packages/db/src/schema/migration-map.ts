/**
 * GC-Stats — migration-map module
 *
 * Tooling table for the one-shot V1 (MariaDB) -> V2 (Postgres) data
 * migration script (packages/db/scripts/migrate-v1/). Not part of the
 * app's domain model; lets the migration re-run without duplicating rows,
 * by remembering which V2 row was created for a given (entityType,
 * legacyId) pair.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, timestamp, unique } from "drizzle-orm/pg-core";

export const migrationIdMap = pgTable("migration_id_map", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entityType: text("entity_type").notNull(), // e.g. 'team', 'person', 'tournament', 'match'
  legacyId: bigint("legacy_id", { mode: "number" }).notNull(), // V1 MariaDB primary key
  newId: bigint("new_id", { mode: "number" }).notNull(), // V2 Postgres primary key
  migratedAt: timestamp("migrated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("migration_id_map_entity_legacy_unique").on(t.entityType, t.legacyId),
]);

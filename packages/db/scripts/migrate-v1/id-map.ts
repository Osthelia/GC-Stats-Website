/**
 * GC-Stats — id-map
 *
 * Read/write helpers around the `migration_id_map` table, mapping V1
 * legacy ids to their new V2 ids per entity type. Backed by an in-memory
 * cache for speed within a run, while the DB table keeps re-runs
 * idempotent across process restarts.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq } from "drizzle-orm";
import { db } from "./connection";
import { migrationIdMap } from "../../src/schema";

// db.transaction()'s callback gets a `tx` handle, not the plain `db` — it's
// a different (but structurally near-identical, for our purposes: .insert/
// .query) type. Accepting the union lets every helper below run against
// either, so callers can pass `tx` when they need insert + id-map write to
// commit-or-rollback together.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

// In-memory cache on top of migration_id_map — avoids a round trip per
// lookup during a single run, while the DB table is what makes re-runs
// idempotent across process restarts.
const cache = new Map<string, number>();
const key = (entityType: string, legacyId: number) => `${entityType}:${legacyId}`;

export async function getMappedId(entityType: string, legacyId: number): Promise<number | undefined> {
  const k = key(entityType, legacyId);
  if (cache.has(k)) return cache.get(k);
  const row = await db.query.migrationIdMap.findFirst({
    where: and(eq(migrationIdMap.entityType, entityType), eq(migrationIdMap.legacyId, legacyId)),
  });
  if (row) cache.set(k, row.newId);
  return row?.newId;
}

// Synchronous cache-only read — for batchInsert's toInsertValue callback,
// which must stay sync. Only safe to call after preloadEntityType has
// primed the cache for entityType (a miss silently returns undefined
// instead of falling back to a DB round trip, unlike getMappedId).
export function tryMappedId(entityType: string, legacyId: number): number | undefined {
  return cache.get(key(entityType, legacyId));
}

export async function setMappedId(entityType: string, legacyId: number, newId: number, executor: Executor = db): Promise<void> {
  cache.set(key(entityType, legacyId), newId);
  await executor.insert(migrationIdMap)
    .values({ entityType, legacyId, newId })
    .onConflictDoUpdate({
      target: [migrationIdMap.entityType, migrationIdMap.legacyId],
      set: { newId },
    });
}

export async function setMappedIdsBatch(entityType: string, pairs: { legacyId: number; newId: number }[], executor: Executor = db): Promise<void> {
  if (pairs.length === 0) return;
  for (const p of pairs) cache.set(key(entityType, p.legacyId), p.newId);
  await executor.insert(migrationIdMap)
    .values(pairs.map((p) => ({ entityType, legacyId: p.legacyId, newId: p.newId })))
    .onConflictDoUpdate({
      target: [migrationIdMap.entityType, migrationIdMap.legacyId],
      set: { newId: migrationIdMap.newId },
    });
}

// Preloads the whole map for one entity type into cache — cuts down on
// per-row lookups for phases that reference thousands of already-migrated
// rows (e.g. matches referencing teams/tournaments).
export async function preloadEntityType(entityType: string): Promise<void> {
  const rows = await db.query.migrationIdMap.findMany({
    where: eq(migrationIdMap.entityType, entityType),
  });
  for (const row of rows) cache.set(key(entityType, row.legacyId), row.newId);
}

// Inserts many rows in chunks (drizzle .values([...]) as a single INSERT per
// chunk, with .returning({id}) — Postgres preserves input order in the
// output for a plain multi-row VALUES insert, so zipping results back to
// legacyIds by position is safe) and records the id map for each. Cuts a
// 10k-row phase from ~10k round trips to ~20.
//
// insert + id-map write happen inside one db.transaction per chunk, and
// insertFn/setMappedIdsBatch are both called against the transaction's own
// executor (`tx`, not the module-level `db`) — otherwise "transaction" would
// wrap nothing, since neither call would actually run on that connection.
// This matters because it's already bitten us once: a process killed
// between a committed insert and its id-map write leaves an orphan row that
// a re-run doesn't know about, tries to re-insert, and collides with on the
// table's own uniqueness/exclusion constraint.
export async function batchInsert<TLegacy>(
  entityType: string,
  legacyRows: TLegacy[],
  legacyId: (row: TLegacy) => number,
  toInsertValue: (row: TLegacy) => Record<string, unknown> | null,
  insertFn: (tx: Executor, values: Record<string, unknown>[]) => Promise<{ id: number }[]>,
  chunkSize = 500,
): Promise<{ created: number; skipped: number; invalid: number }> {
  await preloadEntityType(entityType); // turns the skip-check below into pure cache hits
  let created = 0, skipped = 0, invalid = 0;
  const pending: { legacyId: number; value: Record<string, unknown> }[] = [];
  for (const row of legacyRows) {
    const lid = legacyId(row);
    // tryMappedId, not getMappedId: preloadEntityType above already loaded
    // every existing mapping for this entityType, so a cache miss here means
    // "genuinely not migrated yet", not "go check the DB". Using getMappedId
    // turned this into one network round trip per row for any entityType
    // that's new or mostly-unmigrated — fine at a few thousand rows, but it
    // silently turned a 262k-row phase (map_round_kills_raw) into hours of
    // sequential round trips with zero rows inserted in the meantime.
    if (tryMappedId(entityType, lid)) { skipped++; continue; }
    const value = toInsertValue(row);
    if (!value) { invalid++; continue; }
    pending.push({ legacyId: lid, value });
  }
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize);
    await db.transaction(async (tx) => {
      const inserted = await insertFn(tx, chunk.map((c) => c.value));
      await setMappedIdsBatch(entityType, chunk.map((c, j) => ({ legacyId: c.legacyId, newId: inserted[j].id })), tx);
    });
    created += chunk.length;
  }
  return { created, skipped, invalid };
}

export function requireMappedId(entityType: string, legacyId: number): number {
  const k = key(entityType, legacyId);
  const v = cache.get(k);
  if (v === undefined) throw new Error(`No migrated id for ${entityType}:${legacyId} — did an earlier phase run?`);
  return v;
}

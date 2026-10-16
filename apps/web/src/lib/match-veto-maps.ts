/**
 * GC-Stats - match-veto-maps
 *
 * Rebuilds a match's played maps from its veto, shared by the admin veto
 * form and the live veto.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import type { adminDb } from "@gc-stats/db/client";
import { valorantTables } from "@gc-stats/db";

type Tx = Pick<typeof adminDb, "select" | "insert" | "update" | "delete">;

/**
 * One map per pick/decider in veto order, reusing an existing map of the
 * same name (keeps its stats and match id), dropping maps no longer in the veto.
 */
export async function syncPlayedMapsFromVeto(tx: Tx, matchId: number, rows: { mapName: string; type: string }[]): Promise<void> {
  const { maps } = valorantTables;
  const existingMaps = await tx.select({ id: maps.id, mapName: maps.mapName }).from(maps).where(eq(maps.matchId, matchId)).orderBy(maps.order);
  const keptIds = new Set<number>();
  const played = rows.filter((row) => row.type === "pick" || row.type === "decider");
  for (const [index, row] of played.entries()) {
    const existing = existingMaps.find((m) => m.mapName === row.mapName && !keptIds.has(m.id));
    if (existing) {
      await tx.update(maps).set({ order: index + 1 }).where(eq(maps.id, existing.id));
      keptIds.add(existing.id);
    } else {
      const [created] = await tx.insert(maps).values({ matchId, mapName: row.mapName, order: index + 1, isCompleted: false }).returning({ id: maps.id });
      if (created) keptIds.add(created.id);
    }
  }
  const removedIds = existingMaps.filter((m) => !keptIds.has(m.id)).map((m) => m.id);
  if (removedIds.length > 0) await tx.delete(maps).where(inArray(maps.id, removedIds));
}

/**
 * GC-Stats — 14-group-entries
 *
 * Ported from the one-off packages/db/scripts/backfill-group-entries.mjs
 * into the regular migrate-v1 pipeline so it runs automatically against
 * whichever DATABASE_URL the migration job targets. computeContainerStandings()
 * (apps/web/src/lib/bracket/standings.ts) reads only group_entries, never
 * matches directly, so an empty group_entries renders every Swiss/round-robin
 * standings table as empty despite real match data existing.
 *
 * Idempotent: skips any container that already has group_entries rows.
 * Derives entrants from match participation (no bye bookkeeping exists for
 * migrated containers). buchholz mirrors recomputeBuchholz() in
 * packages/bracket-engine/src/generators/swiss-pairing-engine.ts; round_diff
 * is left at 0 since no historical data can compute it.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "./connection";
import { stageContainers, matches, entrants, groupEntries } from "../../src/schema";

export async function backfillGroupEntries() {
  const groupContainers = await db
    .select({ id: stageContainers.id })
    .from(stageContainers)
    .where(eq(stageContainers.containerType, "group"));

  let containersFilled = 0;
  let entriesInserted = 0;

  for (const container of groupContainers) {
    const existingCount = await db.$count(groupEntries, eq(groupEntries.containerId, container.id));
    if (existingCount > 0) continue;

    const containerMatches = await db
      .select({ entrantAId: matches.entrantAId, entrantBId: matches.entrantBId, winnerId: matches.winnerId, status: matches.status })
      .from(matches)
      .where(eq(matches.containerId, container.id));
    if (containerMatches.length === 0) continue;

    const entrantIds = new Set<number>();
    for (const m of containerMatches) {
      if (m.entrantAId !== null) entrantIds.add(m.entrantAId);
      if (m.entrantBId !== null) entrantIds.add(m.entrantBId);
    }
    if (entrantIds.size === 0) continue;

    const seedRows = await db.select({ id: entrants.id, seed: entrants.seed }).from(entrants).where(inArray(entrants.id, [...entrantIds]));
    const seedById = new Map(seedRows.map((r) => [r.id, r.seed]));

    const wins = new Map([...entrantIds].map((id) => [id, 0]));
    const losses = new Map([...entrantIds].map((id) => [id, 0]));
    for (const m of containerMatches) {
      if (m.status !== "completed" || m.winnerId === null) continue;
      if (wins.has(m.winnerId)) wins.set(m.winnerId, wins.get(m.winnerId)! + 1);
      const loserId = m.winnerId === m.entrantAId ? m.entrantBId : m.winnerId === m.entrantBId ? m.entrantAId : null;
      if (loserId !== null && losses.has(loserId)) losses.set(loserId, losses.get(loserId)! + 1);
    }

    const buchholz = new Map([...entrantIds].map((id) => [id, 0]));
    for (const m of containerMatches) {
      if (m.entrantAId === null || m.entrantBId === null) continue;
      if (buchholz.has(m.entrantAId)) buchholz.set(m.entrantAId, buchholz.get(m.entrantAId)! + (wins.get(m.entrantBId) ?? 0));
      if (buchholz.has(m.entrantBId)) buchholz.set(m.entrantBId, buchholz.get(m.entrantBId)! + (wins.get(m.entrantAId) ?? 0));
    }

    for (const entrantId of entrantIds) {
      await db.insert(groupEntries).values({
        containerId: container.id,
        entrantId,
        seed: seedById.get(entrantId) ?? null,
        wins: wins.get(entrantId) ?? 0,
        losses: losses.get(entrantId) ?? 0,
        buchholz: (buchholz.get(entrantId) ?? 0) * 100,
        roundDiff: 0,
        hadBye: false,
        status: "active",
      });
      entriesInserted++;
    }
    containersFilled++;
  }

  console.log(`group_entries backfill: ${containersFilled} containers filled, ${entriesInserted} entries inserted`);
}

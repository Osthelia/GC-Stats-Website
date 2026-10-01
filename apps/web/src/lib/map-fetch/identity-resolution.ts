/**
 * GC-Stats - identity-resolution
 *
 * Maps Riot puuids to GC-Stats `people` rows for map ingestion: finds already
 * known mappings, flags missing ones for admin input, persists new manual
 * mappings, and infers which Riot team color corresponds to entrant A.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { people, entrantMembers } from "@gc-stats/db";
import { resolveAgentName, type RiotContent } from "@/lib/riot-content-client";

export type ValIdColumn = "valId" | "esportsValId";

export interface RiotPlayerRef {
  puuid: string;
  gameName: string;
  tagLine: string;
  teamId: "Red" | "Blue";
  characterId: string;
}

/** Which `people` rows already have a known Riot identity for these puuids, on the given column. */
export async function findPersonIdsByPuuids(puuids: string[], column: ValIdColumn): Promise<Map<string, number>> {
  if (puuids.length === 0) return new Map();
  const col = column === "valId" ? people.valId : people.esportsValId;
  const rows = await db
    .select({ id: people.id, val: col })
    .from(people)
    .where(inArray(col, puuids));

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.val) map.set(row.val, row.id);
  }
  return map;
}

export interface MissingPuuidPlayer {
  puuid: string;
  displayName: string;
  agentName: string;
  teamColor: "Red" | "Blue";
}

/** Riot players whose puuid isn't yet mapped to a GC-Stats person, not covered by an already-supplied manual mapping either. */
export function findMissingPuuids(players: RiotPlayerRef[], known: Map<string, number>, manualMapping: Map<string, number>, content: RiotContent): MissingPuuidPlayer[] {
  const missing: MissingPuuidPlayer[] = [];
  for (const player of players) {
    if (known.has(player.puuid) || manualMapping.has(player.puuid)) continue;
    missing.push({
      puuid: player.puuid,
      displayName: `${player.gameName}#${player.tagLine}`,
      agentName: resolveAgentName(content, player.characterId),
      teamColor: player.teamId,
    });
  }
  return missing;
}

export type PersistPuuidMappingResult = { ok: true } | { ok: false; error: { kind: "puuidConflict" } };

/**
 * Persists an admin-provided puuid -> person mapping. Skips any puuid already
 * claimed by another person (never overwrites an existing link) and reports
 * it as a conflict instead of throwing, including when the pre-check race
 * loses to a concurrent resolution and the unique constraint on
 * `people.valId`/`people.esportsValId` rejects the UPDATE.
 */
export async function persistPuuidMapping(mapping: Map<string, number>, column: ValIdColumn): Promise<PersistPuuidMappingResult> {
  if (mapping.size === 0) return { ok: true };
  const col = column === "valId" ? people.valId : people.esportsValId;

  for (const [puuid, personId] of mapping) {
    const [conflict] = await db.select({ id: people.id }).from(people).where(eq(col, puuid)).limit(1);
    if (conflict) {
      console.warn(`[map-fetch] puuid already mapped to person #${conflict.id}, skipping mapping to person #${personId}`);
      return { ok: false, error: { kind: "puuidConflict" } };
    }
    try {
      if (column === "valId") {
        await db.update(people).set({ valId: puuid }).where(eq(people.id, personId));
      } else {
        await db.update(people).set({ esportsValId: puuid }).where(eq(people.id, personId));
      }
    } catch (err) {
      console.warn(`[map-fetch] puuid mapping to person #${personId} failed (likely a concurrent conflict): ${err instanceof Error ? err.message : String(err)}`);
      return { ok: false, error: { kind: "puuidConflict" } };
    }
  }
  return { ok: true };
}

/** Which Riot team color ("Red"/"Blue") corresponds to entrant A, via whichever puuids are already resolved to a roster member. Null if ambiguous (no resolved puuid on either side). */
export function resolveTeamAColor(entrantAPersonIds: Set<number>, entrantBPersonIds: Set<number>, players: RiotPlayerRef[], known: Map<string, number>): "Red" | "Blue" | null {
  for (const player of players) {
    const personId = known.get(player.puuid);
    if (personId === undefined) continue;
    if (entrantAPersonIds.has(personId)) return player.teamId;
    if (entrantBPersonIds.has(personId)) return player.teamId === "Red" ? "Blue" : "Red";
  }
  return null;
}

export async function getEntrantPersonIds(entrantId: number): Promise<Set<number>> {
  const rows = await db.select({ personId: entrantMembers.personId }).from(entrantMembers).where(eq(entrantMembers.entrantId, entrantId));
  return new Set(rows.map((r) => r.personId));
}

/**
 * GC-Stats - points
 *
 * Tallies the points tiebreaker of a group: match, map and round won or
 * lost, a forfeited match being worth the forfeit values alone.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { groupEntries, matches, maps } from "@gc-stats/db";
import type { Tx } from "./repository";
import type { StandingsPointsConfig } from "./config-types";

// What the points need of a completed match
export interface PointsMatch {
  entrantAId: number | null;
  entrantBId: number | null;
  winnerId: number | null;
  // Maps won by each side
  scoreA: number | null;
  scoreB: number | null;
  // Rounds won by each side over the played maps, null when no map was recorded
  roundsA: number | null;
  roundsB: number | null;
  forfeit: boolean;
}

/** Points of one entrant over its completed matches, a bye counting as a match won. */
export function entrantPoints(config: StandingsPointsConfig, entrantId: number, played: readonly PointsMatch[], hadBye: boolean): number {
  let total = hadBye ? config.matchWin : 0;
  for (const m of played) {
    const isA = m.entrantAId === entrantId;
    if (!isA && m.entrantBId !== entrantId) continue;
    const won = m.winnerId === entrantId;
    if (m.forfeit) {
      total += won ? config.forfeitWin : config.forfeitLoss;
      continue;
    }
    total += won ? config.matchWin : config.matchLoss;
    const mapsWon = isA ? [m.scoreA, m.scoreB] : [m.scoreB, m.scoreA];
    if (mapsWon[0] !== null && mapsWon[1] !== null) total += mapsWon[0]! * config.mapWin + mapsWon[1]! * config.mapLoss;
    const rounds = isA ? [m.roundsA, m.roundsB] : [m.roundsB, m.roundsA];
    if (rounds[0] !== null && rounds[1] !== null) total += rounds[0]! * config.roundWin + rounds[1]! * config.roundLoss;
  }
  return total;
}

/** Points of every entrant of a group. Rounds come from the map scores, forfeited maps excluded. */
export async function computeContainerPoints(tx: Tx, containerId: number, config: StandingsPointsConfig): Promise<Map<number, number>> {
  const [completed, entries] = await Promise.all([
    tx.select().from(matches).where(and(eq(matches.containerId, containerId), eq(matches.status, "completed"))),
    tx.select({ entrantId: groupEntries.entrantId, hadBye: groupEntries.hadBye }).from(groupEntries).where(eq(groupEntries.containerId, containerId)),
  ]);

  const rounds = new Map<number, { a: number; b: number }>();
  if (completed.length > 0) {
    const mapRows = await tx.select().from(maps).where(inArray(maps.matchId, completed.map((m) => m.id)));
    for (const mp of mapRows) {
      if (!mp.isCompleted || mp.isForfeit || mp.teamAScore === null || mp.teamBScore === null) continue;
      const cur = rounds.get(mp.matchId) ?? { a: 0, b: 0 };
      rounds.set(mp.matchId, { a: cur.a + mp.teamAScore, b: cur.b + mp.teamBScore });
    }
  }

  const played: PointsMatch[] = completed.map((m) => ({
    entrantAId: m.entrantAId,
    entrantBId: m.entrantBId,
    winnerId: m.winnerId,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    roundsA: rounds.get(m.id)?.a ?? null,
    roundsB: rounds.get(m.id)?.b ?? null,
    forfeit: m.isForfeit,
  }));
  const hadBye = new Map(entries.map((e) => [e.entrantId, e.hadBye]));
  const ids = new Set([...hadBye.keys(), ...played.flatMap((m) => [m.entrantAId, m.entrantBId]).filter((id): id is number => id !== null)]);
  return new Map([...ids].map((id) => [id, entrantPoints(config, id, played, hadBye.get(id) ?? false)]));
}

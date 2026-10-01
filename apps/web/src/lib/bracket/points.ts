/**
 * GC-Stats - points
 *
 * Tallies the configurable points tiebreaker (match/map/round wins, with
 * separate forfeit values) used by the group standings calculation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { matches, maps, mapRoundsRaw } from "@gc-stats/db";
import type { Tx } from "./repository";
import type { StandingsPointsConfig } from "./config-types";

/**
 * Tallies the configurable points tiebreaker (2026-08-31 spec) for every
 * entrant with at least one completed match in `containerId`: match wins,
 * map wins, and round wins, each with a separate (optional) value for a
 * forfeited win. `maps.teamAScore`/`teamBScore` map to
 * `matches.entrantAId`/`entrantBId` — the same convention used throughout
 * the match-detail data layer (`match-page-data.ts`), not invented here.
 */
export async function computeContainerPoints(tx: Tx, containerId: number, config: StandingsPointsConfig): Promise<Map<number, number>> {
  const points = new Map<number, number>();
  const add = (entrantId: number | null, amount: number | null) => {
    if (entrantId === null || amount === null) return;
    points.set(entrantId, (points.get(entrantId) ?? 0) + amount);
  };

  const completedMatches = await tx.select().from(matches).where(eq(matches.containerId, containerId));
  const finished = completedMatches.filter((m) => m.status === "completed" && m.winnerId !== null);

  if (config.matchWin !== null || config.matchForfeitWin !== null) {
    for (const m of finished) {
      add(m.winnerId, m.isForfeit ? config.matchForfeitWin : config.matchWin);
    }
  }

  const needsMapData = config.mapWin !== null || config.mapForfeitWin !== null || config.roundWin !== null;
  if (!needsMapData || finished.length === 0) return points;

  const matchById = new Map(finished.map((m) => [m.id, m]));
  const mapRows = await tx.select().from(maps).where(inArray(maps.matchId, finished.map((m) => m.id)));
  const completedMaps = mapRows.filter((mp) => mp.isCompleted && mp.teamAScore !== null && mp.teamBScore !== null);

  if (config.mapWin !== null || config.mapForfeitWin !== null) {
    for (const mp of completedMaps) {
      const match = matchById.get(mp.matchId);
      if (!match) continue;
      const winnerId = mp.teamAScore! > mp.teamBScore! ? match.entrantAId : mp.teamBScore! > mp.teamAScore! ? match.entrantBId : null;
      add(winnerId, mp.isForfeit ? config.mapForfeitWin : config.mapWin);
    }
  }

  if (config.roundWin !== null && completedMaps.length > 0) {
    const roundRows = await tx.select({ winningEntrantId: mapRoundsRaw.winningEntrantId }).from(mapRoundsRaw).where(inArray(mapRoundsRaw.mapId, completedMaps.map((mp) => mp.id)));
    for (const r of roundRows) {
      add(r.winningEntrantId, config.roundWin);
    }
  }

  return points;
}

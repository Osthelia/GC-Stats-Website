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
import { gameTables, valorantTablesOf } from "@gc-stats/db";
import { listMatchMapResults, type Tx } from "./repository";
import type { StandingsPointsConfig } from "./config-types";
import type { GameSlug } from "@gc-stats/db/game";

/**
 * Tallies the configurable points tiebreaker (2026-08-31 spec) for every
 * entrant with at least one completed match in `containerId`: match wins,
 * map wins, and round wins, each with a separate (optional) value for a
 * forfeited win. `maps.teamAScore`/`teamBScore` map to
 * `matches.entrantAId`/`entrantBId` — the same convention used throughout
 * the match-detail data layer (`match-page-data.ts`), not invented here.
 */
export async function computeContainerPoints(game: GameSlug, tx: Tx, containerId: number, config: StandingsPointsConfig): Promise<Map<number, number>> {
  const { matches } = gameTables(game);
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
  const mapResults = await listMatchMapResults(game, tx, finished.map((m) => m.id));

  if (config.mapWin !== null || config.mapForfeitWin !== null) {
    for (const map of mapResults) {
      const match = matchById.get(map.matchId);
      if (!match || map.winner === null) continue;
      const winnerId = map.winner === "a" ? match.entrantAId : match.entrantBId;
      add(winnerId, map.isForfeit ? config.mapForfeitWin : config.mapWin);
    }
  }

  // Round wins only exist for Valorant maps: a LoL game has no round scores, so it is filtered out here.
  const scoredMapIds = mapResults.filter((map) => map.isCompleted && map.roundsA !== null && map.roundsB !== null).map((map) => map.id);
  if (config.roundWin !== null && scoredMapIds.length > 0) {
    const { mapRoundsRaw } = valorantTablesOf(game);
    const roundRows = await tx.select({ winningEntrantId: mapRoundsRaw.winningEntrantId }).from(mapRoundsRaw).where(inArray(mapRoundsRaw.mapId, scoredMapIds));
    for (const r of roundRows) {
      add(r.winningEntrantId, config.roundWin);
    }
  }

  return points;
}

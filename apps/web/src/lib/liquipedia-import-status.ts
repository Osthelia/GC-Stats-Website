/**
 * GC-Stats - liquipedia-import-status
 *
 * How far each match of a tournament got through the Liquipedia import:
 * nothing done, Riot match ids present but not fetched, or fetched.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
// adminDb: the page must show the import that just ran (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { maps, matches, stageContainers, stages, mapPlayerStats } from "@gc-stats/db";
import type { LiquipediaImportStatus } from "@/lib/liquipedia-import-status-types";

export async function getTournamentImportStatuses(tournamentId: number): Promise<Record<number, LiquipediaImportStatus>> {
  const mapRows = await db
    .select({ id: maps.id, matchId: maps.matchId, apiMatchId: maps.apiMatchId, teamAScore: maps.teamAScore, teamBScore: maps.teamBScore })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));

  const withApiId = mapRows.filter((m) => m.apiMatchId);
  const fetchedMapIds = new Set(
    withApiId.length > 0
      ? (
          await db
            .selectDistinct({ mapId: mapPlayerStats.mapId })
            .from(mapPlayerStats)
            .where(inArray(mapPlayerStats.mapId, withApiId.map((m) => m.id)))
        ).map((r) => r.mapId)
      : []
  );

  const byMatch = new Map<number, { withId: number; fetched: number }>();
  for (const map of withApiId) {
    const entry = byMatch.get(map.matchId) ?? { withId: 0, fetched: 0 };
    entry.withId += 1;
    if (fetchedMapIds.has(map.id)) entry.fetched += 1;
    byMatch.set(map.matchId, entry);
  }

  const result: Record<number, LiquipediaImportStatus> = {};
  for (const [matchId, entry] of byMatch) result[matchId] = entry.fetched === entry.withId ? "done" : "partial";
  return result;
}

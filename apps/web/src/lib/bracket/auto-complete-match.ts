/**
 * GC-Stats - auto-complete-match
 *
 * After a map fetch, checks whether a series is decided and, if so, reports
 * the result through the shared match resolution service, propagating the
 * win through the bracket. Must run after the map data transaction commits.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matches, maps } from "@gc-stats/db";
import { resolveMatch } from "./match-resolution-service";

/**
 * After a map fetch, checks whether the series is now decided and, if so,
 * reports the match result through the same `resolveMatch` entry point a
 * manual "report result" action uses — this is what actually propagates the
 * win through the bracket (bracketEdges, group standings, qualifications).
 * Mirrors V1's GameMapController::recomputeMatchScore, minus the duplicate
 * logic: this only tallies map wins and hands off to the real resolver.
 *
 * Always called AFTER the map data transaction has committed, never nested
 * inside it — `resolveMatch` opens its own transaction on a separate
 * connection, which would not see uncommitted writes from an outer one.
 */
export async function maybeAutoCompleteMatchFromMaps(matchId: number): Promise<void> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match || match.status === "completed") return;
  if (match.entrantAId === null || match.entrantBId === null) return;

  const mapRows = await db.select().from(maps).where(eq(maps.matchId, matchId));

  let winsA = 0;
  let winsB = 0;
  for (const map of mapRows) {
    if (!map.isCompleted || map.teamAScore === null || map.teamBScore === null) continue;
    if (map.teamAScore > map.teamBScore) winsA++;
    else if (map.teamBScore > map.teamAScore) winsB++;
  }

  const majority = Math.ceil(match.bestOf / 2);
  // BO1: the match score IS the map score (round count), not a 1-0 map-win tally.
  const decidingMap = mapRows.find((m) => m.isCompleted && m.teamAScore !== null && m.teamBScore !== null);
  const [scoreA, scoreB] = match.bestOf === 1 && decidingMap ? [decidingMap.teamAScore!, decidingMap.teamBScore!] : [winsA, winsB];

  if (winsA >= majority) {
    await resolveMatch({ matchId, winnerId: match.entrantAId, scoreA, scoreB });
  } else if (winsB >= majority) {
    await resolveMatch({ matchId, winnerId: match.entrantBId, scoreA, scoreB });
  }
}

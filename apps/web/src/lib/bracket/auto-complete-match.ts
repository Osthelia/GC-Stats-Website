/**
 * GC-Stats - auto-complete-match
 *
 * After a map changes (fetch or manual edit), recomputes the series score
 * from its maps and, once decided, reports the result through the shared
 * match resolution service, propagating the win through the bracket. Must
 * run after the map data transaction commits.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { matches, maps } from "@gc-stats/db";
import { resolveMatch } from "./match-resolution-service";

/**
 * Recomputes the series score from its completed maps. An undecided match
 * gets the running score; once decided, the result goes through the same
 * `resolveMatch` entry point a manual "report result" action uses — this is
 * what actually propagates the win through the bracket (bracketEdges, group
 * standings, qualifications). Mirrors V1's GameMapController::recomputeMatchScore.
 *
 * An already completed match only gets its score corrected when the winner
 * stays the same: flipping the winner would need the bracket propagation
 * undone, which stays a manual reset.
 *
 * Always called AFTER the map data transaction has committed, never nested
 * inside it — `resolveMatch` opens its own transaction on a separate
 * connection, which would not see uncommitted writes from an outer one.
 */
export async function maybeAutoCompleteMatchFromMaps(matchId: number): Promise<void> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return;
  if (match.entrantAId === null || match.entrantBId === null) return;

  const mapRows = await db.select().from(maps).where(eq(maps.matchId, matchId));
  const playedMaps = mapRows.filter((m) => m.isCompleted && m.teamAScore !== null && m.teamBScore !== null);

  let winsA = 0;
  let winsB = 0;
  for (const map of playedMaps) {
    if (map.teamAScore! > map.teamBScore!) winsA++;
    else if (map.teamBScore! > map.teamAScore!) winsB++;
  }

  const majority = Math.ceil(match.bestOf / 2);
  // BO1: the match score IS the map score (round count), not a 1-0 map-win tally.
  const decidingMap = playedMaps[0];
  const [scoreA, scoreB] = match.bestOf === 1 && decidingMap ? [decidingMap.teamAScore!, decidingMap.teamBScore!] : [winsA, winsB];
  const winnerId = winsA >= majority ? match.entrantAId : winsB >= majority ? match.entrantBId : null;

  if (match.status === "completed") {
    if (!match.isForfeit && winnerId !== null && winnerId === match.winnerId && (match.scoreA !== scoreA || match.scoreB !== scoreB)) {
      await db.update(matches).set({ scoreA, scoreB }).where(eq(matches.id, matchId));
    }
    return;
  }

  if (winnerId !== null) {
    await resolveMatch({ matchId, winnerId, scoreA, scoreB });
    return;
  }

  // No maps at all: leave whatever score an admin typed by hand.
  if (mapRows.length === 0) return;
  const runningA = playedMaps.length > 0 ? scoreA : null;
  const runningB = playedMaps.length > 0 ? scoreB : null;
  if (match.scoreA !== runningA || match.scoreB !== runningB) {
    await db.update(matches).set({ scoreA: runningA, scoreB: runningB }).where(eq(matches.id, matchId));
  }
}

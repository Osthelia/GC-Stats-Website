/**
 * GC-Stats - admin-match-score-backfill
 *
 * Bulk recomputes the series score (and winner) of a tournament's matches
 * that have completed maps but no match score — V1-migrated matches whose
 * score was never filled in. Preview first, then apply.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { matches, maps, stages, stageContainers, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { matchTag } from "@/lib/cache-tags";
import { syncGroupRecordsFromMatches } from "@/lib/bracket/group-progression";

const ID_CHUNK = 1000;
const SAMPLE_SIZE = 50;

type Candidate = {
  id: number;
  bestOf: number;
  winnerId: number | null;
  entrantAId: number;
  entrantBId: number;
  winsA: number;
  winsB: number;
  played: number;
  firstA: number;
  firstB: number;
};

type Computed = { id: number; scoreA: number; scoreB: number; winnerId: number; winnerIsA: boolean };

export type ScoreBackfillSample = { matchId: number; scoreA: number; scoreB: number };
export type ScoreBackfillReport = {
  ok: true;
  /** Matches that get (or got) a score and winner. */
  resolvable: number;
  /** Maps don't decide the series (tie, or not enough maps for the best-of). */
  undecided: number;
  /** The maps designate a different winner than the one already stored. */
  conflicts: number;
  sample: ScoreBackfillSample[];
  conflictSample: ScoreBackfillSample[];
};

/**
 * Same score convention as maybeAutoCompleteMatchFromMaps: a BO1 shows the
 * round score of its map, anything else the map-win tally. Historical
 * best-of values are unreliable (V1 defaulted to 1), so when more maps were
 * played than the best-of allows, the map count wins and the side with more
 * map wins is the winner.
 */
function compute(c: Candidate): Computed | "undecided" {
  const isBo1 = c.played === 1 && c.bestOf <= 1;
  const [scoreA, scoreB] = isBo1 ? [c.firstA, c.firstB] : [c.winsA, c.winsB];
  if (c.winsA === c.winsB) return "undecided";
  const majority = c.played > c.bestOf ? 1 : Math.ceil(c.bestOf / 2);
  const winnerId = c.winsA >= majority && c.winsA > c.winsB ? c.entrantAId : c.winsB >= majority && c.winsB > c.winsA ? c.entrantBId : null;
  if (winnerId === null) return "undecided";
  return { id: c.id, scoreA, scoreB, winnerId, winnerIsA: winnerId === c.entrantAId };
}

async function loadCandidates(tournamentId: number): Promise<Candidate[]> {
  const rows = await db
    .select({
      id: matches.id,
      bestOf: matches.bestOf,
      winnerId: matches.winnerId,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      winsA: sql<number>`(count(*) filter (where ${maps.teamAScore} > ${maps.teamBScore}))::int`,
      winsB: sql<number>`(count(*) filter (where ${maps.teamBScore} > ${maps.teamAScore}))::int`,
      played: sql<number>`count(*)::int`,
      firstA: sql<number>`(array_agg(${maps.teamAScore} order by ${maps.order}, ${maps.id}))[1]`,
      firstB: sql<number>`(array_agg(${maps.teamBScore} order by ${maps.order}, ${maps.id}))[1]`,
    })
    .from(matches)
    .innerJoin(maps, and(eq(maps.matchId, matches.id), eq(maps.isCompleted, true), isNotNull(maps.teamAScore), isNotNull(maps.teamBScore)))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(and(eq(stages.tournamentId, tournamentId), or(isNull(matches.scoreA), isNull(matches.scoreB)), eq(matches.isForfeit, false), isNotNull(matches.entrantAId), isNotNull(matches.entrantBId)))
    .groupBy(matches.id);
  return rows as Candidate[];
}

function sampleRows(computed: Computed[]): ScoreBackfillSample[] {
  return computed.slice(0, SAMPLE_SIZE).map((c) => ({ matchId: c.id, scoreA: c.scoreA, scoreB: c.scoreB }));
}

/**
 * Previews (`apply = false`) or applies the backfill. Applying sets the
 * score, the winner and the "completed" status — a status/result fix-up
 * only, like bulkSetMatchStatus: no resolveMatch, no bracket propagation
 * (historical brackets were already filled in by the migration), but group
 * records are realigned on the new winners. A match
 * whose stored winner disagrees with its maps is left untouched and
 * reported as a conflict.
 */
export async function backfillMatchScoresFromMaps(tournamentId: number, apply: boolean): Promise<ScoreBackfillReport> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);

  const resolvable: Computed[] = [];
  const conflicts: Computed[] = [];
  let undecided = 0;
  for (const candidate of await loadCandidates(tournamentId)) {
    const result = compute(candidate);
    if (result === "undecided") undecided++;
    else if (candidate.winnerId !== null && candidate.winnerId !== result.winnerId) conflicts.push(result);
    else resolvable.push(result);
  }
  resolvable.sort((a, b) => a.id - b.id);
  conflicts.sort((a, b) => a.id - b.id);

  if (apply && resolvable.length > 0) {
    // Few distinct (score, winner side) combinations exist, so grouping
    // turns thousands of rows into a handful of UPDATEs.
    const groups = new Map<string, { scoreA: number; scoreB: number; winnerIsA: boolean; ids: number[] }>();
    for (const r of resolvable) {
      const key = `${r.scoreA}:${r.scoreB}:${r.winnerIsA}`;
      const group = groups.get(key) ?? { scoreA: r.scoreA, scoreB: r.scoreB, winnerIsA: r.winnerIsA, ids: [] };
      group.ids.push(r.id);
      groups.set(key, group);
    }
    await db.transaction(async (tx) => {
      for (const group of groups.values()) {
        for (let i = 0; i < group.ids.length; i += ID_CHUNK) {
          await tx
            .update(matches)
            .set({
              scoreA: group.scoreA,
              scoreB: group.scoreB,
              winnerId: group.winnerIsA ? sql`${matches.entrantAId}` : sql`${matches.entrantBId}`,
              status: "completed",
            })
            // Re-checks the "no score yet" guard so a concurrent edit isn't overwritten.
            .where(and(inArray(matches.id, group.ids.slice(i, i + ID_CHUNK)), or(isNull(matches.scoreA), isNull(matches.scoreB))));
        }
      }
      // New winners change the group records (wins, losses, Buchholz).
      const groupContainers = await tx
        .select({ id: stageContainers.id })
        .from(stageContainers)
        .innerJoin(stages, eq(stages.id, stageContainers.stageId))
        .where(and(eq(stages.tournamentId, tournamentId), eq(stageContainers.containerType, "group")));
      for (const c of groupContainers) await syncGroupRecordsFromMatches(tx, c.id);
    });
    for (const r of resolvable) updateTag(matchTag(r.id));
  }

  return { ok: true, resolvable: resolvable.length, undecided, conflicts: conflicts.length, sample: sampleRows(resolvable), conflictSample: sampleRows(conflicts) };
}

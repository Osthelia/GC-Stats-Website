/**
 * GC-Stats - match-resolution-service
 *
 * The single entry point for reporting a match result: validates it's
 * resolvable, then in one transaction marks it completed and propagates
 * the outcome through the bracket graph, group standings and qualifications.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matches, stageContainers, stages } from "@gc-stats/db";
import { resolveMatchInGraph } from "@gc-stats/bracket-engine";
import { applyDownstreamPatches, hydrateOutgoingSubgraph, getMatch, type Tx } from "./repository";
import { advanceSwissGroup, advanceRoundRobinGroup } from "./group-progression";
import { resolveContainerRankQualifications, resolveContainerMatchQualifications } from "./qualification-resolution";
import { parseGroupConfig } from "./config-types";

export class MatchResolutionValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("MatchResolutionValidationError");
  }
}

export interface ResolveMatchInput {
  matchId: number;
  winnerId: number;
  /** A real non-negative score, or the V1 forfeit sentinel `-1` for
   *  whichever side forfeited (mirrors Website's `Matchs`/`GameMap` score
   *  columns — there is no separate boolean field, `-1` on one side *is*
   *  the forfeit). `isForfeit` (stored, feeds the points tiebreaker in
   *  lib/bracket/points.ts) is derived below, never accepted from the caller. */
  scoreA: number;
  scoreB: number;
}

/**
 * The single entry point for reporting a match result. Re-validates the
 * match is actually resolvable before touching anything, with a precise
 * field-level error on failure, then in one transaction:
 *   1. marks the match completed with its score/winner
 *   2. propagates winner/loser across `bracketEdges` into downstream matches
 *      (pure `resolveMatchInGraph`, cf. packages/bracket-engine) — this is
 *      the "auto progress" a single/double-elim bracket needs
 *   3. if the match belongs to a group container, updates that group's
 *      record-keeping (wins/losses, standings) and, for Swiss, either
 *      generates the next round or reports the group as decided
 *   4. once a container is fully decided, resolves whatever
 *      `stage_qualifications` rules feed off it (rank-based from a group,
 *      or match-outcome-based from a bracket) — the cross-container/
 *      cross-stage half of auto progression
 */
export async function resolveMatch(input: ResolveMatchInput): Promise<void> {
  const match = await getMatch(input.matchId);
  if (!match) throw new MatchResolutionValidationError({ matchId: "notFound" });
  if (match.status === "completed") throw new MatchResolutionValidationError({ matchId: "alreadyCompleted" });
  if (match.entrantAId === null || match.entrantBId === null) {
    throw new MatchResolutionValidationError({ matchId: "notReady" });
  }
  if (input.winnerId !== match.entrantAId && input.winnerId !== match.entrantBId) {
    throw new MatchResolutionValidationError({ winnerId: "mustBeAMatchParticipant" });
  }
  if (!Number.isInteger(input.scoreA) || !Number.isInteger(input.scoreB) || input.scoreA < -1 || input.scoreB < -1) {
    throw new MatchResolutionValidationError({ score: "mustBeANonNegativeInteger" });
  }
  if (input.scoreA === -1 && input.scoreB === -1) {
    throw new MatchResolutionValidationError({ score: "bothCannotForfeit" });
  }

  // V1 has no forfeit boolean field (Website's Matchs/GameMap): a lone `-1`
  // score IS the forfeit, on either the match or the map. Derived here
  // rather than accepted from the caller so this stays the single source of
  // truth — stored only to feed the optional points tiebreaker
  // (lib/bracket/points.ts), never re-read to decide anything about scoring.
  const isForfeit = input.scoreA === -1 || input.scoreB === -1;

  const loserId = input.winnerId === match.entrantAId ? match.entrantBId : match.entrantAId;

  const { outgoingEdges, downstreamMatches } = await hydrateOutgoingSubgraph(input.matchId);
  const { patches } = resolveMatchInGraph({
    matchId: String(input.matchId),
    winnerId: String(input.winnerId),
    loserId: String(loserId),
    outgoingEdges,
    downstreamMatches,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({ status: "completed", scoreA: input.scoreA, scoreB: input.scoreB, winnerId: input.winnerId, isForfeit })
      .where(eq(matches.id, input.matchId));

    await applyDownstreamPatches(tx, patches);

    const [container] = await tx.select().from(stageContainers).where(eq(stageContainers.id, match.containerId));
    if (!container) throw new Error(`resolveMatch: container ${match.containerId} not found`);

    const justCompleted = await isContainerJustCompleted(tx, container, match.round, input.winnerId, loserId);
    if (justCompleted) {
      await completeContainer(tx, container);
    }
  });
}

async function isContainerJustCompleted(
  tx: Tx,
  container: typeof stageContainers.$inferSelect,
  round: number,
  winnerId: number,
  loserId: number
): Promise<boolean> {
  if (container.containerType === "group") {
    const config = parseGroupConfig(container.config);
    if (config.type === "swiss") {
      const result = await advanceSwissGroup(tx, config, { containerId: container.id, round, winnerEntrantId: winnerId, loserEntrantId: loserId });
      return result.completed;
    }
    await advanceRoundRobinGroup(tx, { containerId: container.id, round, winnerEntrantId: winnerId, loserEntrantId: loserId });
    return allMatchesCompleted(tx, container.id);
  }
  // Bracket-type container (single/double/triple elim, GSL): done once
  // every match row in it is completed. No reset-match voiding to worry
  // about — the generators never create one (2026-08-31 decision: a
  // bracket reset isn't a concept this project uses), so the grand final
  // is always the true terminal match.
  return allMatchesCompleted(tx, container.id);
}

async function allMatchesCompleted(tx: Tx, containerId: number): Promise<boolean> {
  const rows = await tx.select().from(matches).where(eq(matches.containerId, containerId));
  return rows.length > 0 && rows.every((r) => r.status === "completed");
}

async function completeContainer(tx: Tx, container: typeof stageContainers.$inferSelect): Promise<void> {
  await tx.update(stageContainers).set({ status: "completed" }).where(eq(stageContainers.id, container.id));

  if (container.containerType === "group") {
    await resolveContainerRankQualifications(tx, container);
  }
  await resolveContainerMatchQualifications(tx, container.id);

  const siblingContainers = await tx.select().from(stageContainers).where(eq(stageContainers.stageId, container.stageId));
  if (siblingContainers.every((c) => c.status === "completed")) {
    await tx.update(stages).set({ status: "completed" }).where(eq(stages.id, container.stageId));
  }
}

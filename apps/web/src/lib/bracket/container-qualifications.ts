/**
 * GC-Stats - container-qualifications
 *
 * Advancement rules ("does this rank / this match's winner keep playing"),
 * used to render the standings' qualification indicator/legend and the
 * bracket's "Qualified" slots.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { stageQualifications, stageContainers, stages, tournaments } from "@gc-stats/db";
import type { Tx } from "./repository";

export type ContainerAdvancementRule = {
  rankFrom: number;
  rankTo: number;
  destinationContainerName: string;
  destinationStageId: number;
  destinationTournamentId: number;
  destinationTournamentName: string;
};

/**
 * Rank-based advancement rules for a group container — mirrors V1's
 * `TournamentController::mapQualificationRule` filtered to
 * `destination_type = 'phase'` (V2: `'container'`): the only kind that
 * decides "does this rank keep playing" (used for the standings' green/red
 * qualification indicator + legend). Placement-only rules (final rank,
 * points, cash prize — V1's `leaderboard.blade.php`) are a different,
 * not-yet-built widget and are intentionally excluded here.
 */
export async function getContainerAdvancementRules(tx: Tx, containerId: number): Promise<ContainerAdvancementRule[]> {
  const rules = await tx
    .select()
    .from(stageQualifications)
    .where(and(eq(stageQualifications.sourceContainerId, containerId), eq(stageQualifications.destinationType, "container")));

  const results: ContainerAdvancementRule[] = [];
  for (const rule of rules) {
    if (rule.rankFrom === null || rule.rankTo === null || rule.destinationContainerId === null) continue;
    const [dest] = await tx
      .select({ containerName: stageContainers.name, stageId: stages.id, tournamentId: tournaments.id, tournamentName: tournaments.name })
      .from(stageContainers)
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
      .where(eq(stageContainers.id, rule.destinationContainerId));
    if (!dest) continue;
    results.push({
      rankFrom: rule.rankFrom,
      rankTo: rule.rankTo,
      destinationContainerName: dest.containerName,
      destinationStageId: dest.stageId,
      destinationTournamentId: dest.tournamentId,
      destinationTournamentName: dest.tournamentName,
    });
  }
  return results.sort((a, b) => a.rankFrom - b.rankFrom);
}

export type MatchAdvancementRule = {
  sourceMatchId: number;
  outcome: "winner" | "loser";
  destinationContainerName: string;
  destinationStageId: number;
  destinationTournamentId: number;
  destinationTournamentName: string;
};

/**
 * Match-based counterpart of `getContainerAdvancementRules`: "the winner
 * (or loser) of this bracket match moves on to that container" — V1's
 * `bracket-grid.blade.php` "Qualified" column. Same `'container'` filter,
 * placement rules stay with the final standings widget.
 */
export async function getMatchAdvancementRules(tx: Tx, matchIds: number[]): Promise<MatchAdvancementRule[]> {
  if (matchIds.length === 0) return [];
  const rows = await tx
    .select({
      sourceMatchId: stageQualifications.sourceMatchId,
      outcome: stageQualifications.outcome,
      destinationContainerName: stageContainers.name,
      destinationStageId: stages.id,
      destinationTournamentId: tournaments.id,
      destinationTournamentName: tournaments.name,
    })
    .from(stageQualifications)
    .innerJoin(stageContainers, eq(stageContainers.id, stageQualifications.destinationContainerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(and(inArray(stageQualifications.sourceMatchId, matchIds), eq(stageQualifications.destinationType, "container")))
    .orderBy(asc(stageQualifications.id));
  return rows.filter((r): r is MatchAdvancementRule => r.sourceMatchId !== null && (r.outcome === "winner" || r.outcome === "loser"));
}

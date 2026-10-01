/**
 * GC-Stats - final-standings
 *
 * Reads a stage's final placement per entrant from already-persisted
 * `qualification_results`, resolved earlier at match-completion time.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, or } from "drizzle-orm";
import { stageQualifications, qualificationResults, stageContainers, matches } from "@gc-stats/db";
import type { Tx } from "./repository";

export type StageFinalStandingRow = {
  qualificationId: number;
  entrantId: number;
  rank: number | null;
  placement: number | null;
  placementLabel: string;
  points: number | null;
  cashPrizeAmount: string | null;
  cashPrizeCurrency: string | null;
};

/**
 * The final result of a stage: one row per entrant that a `destinationType
 * = 'placement'` rule resolved to (grand final winner, bronze match loser,
 * top-N-of-a-group tier, ...) — mirrors V1's `leaderboard.blade.php`, but
 * reads already-persisted `qualification_results` instead of recomputing
 * standings, since resolution already ran at match-completion time
 * (qualification-resolution.ts).
 */
export async function getStageFinalStandings(tx: Tx, stageId: number): Promise<StageFinalStandingRow[]> {
  const containerRows = await tx.select({ id: stageContainers.id }).from(stageContainers).where(eq(stageContainers.stageId, stageId));
  const containerIds = containerRows.map((c) => c.id);
  const matchRows = containerIds.length ? await tx.select({ id: matches.id }).from(matches).where(inArray(matches.containerId, containerIds)) : [];
  const matchIds = matchRows.map((m) => m.id);

  const conditions = [];
  if (containerIds.length) conditions.push(inArray(stageQualifications.sourceContainerId, containerIds));
  if (matchIds.length) conditions.push(inArray(stageQualifications.sourceMatchId, matchIds));
  if (conditions.length === 0) return [];

  const rules = await tx.select().from(stageQualifications).where(and(eq(stageQualifications.destinationType, "placement"), or(...conditions)));
  if (rules.length === 0) return [];

  const results = await tx.select().from(qualificationResults).where(inArray(qualificationResults.qualificationId, rules.map((r) => r.id)));
  const ruleById = new Map(rules.map((r) => [r.id, r]));

  const rows: StageFinalStandingRow[] = [];
  for (const result of results) {
    const rule = ruleById.get(result.qualificationId);
    if (!rule || rule.placement === null || rule.placementLabel === null) continue;
    rows.push({
      qualificationId: rule.id,
      entrantId: result.entrantId,
      rank: result.rank,
      placement: rule.placement,
      placementLabel: rule.placementLabel,
      points: rule.points,
      cashPrizeAmount: rule.cashPrizeAmount,
      cashPrizeCurrency: rule.cashPrizeCurrency,
    });
  }

  return rows.sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999) || (a.rank ?? 0) - (b.rank ?? 0));
}

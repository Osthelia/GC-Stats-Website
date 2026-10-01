/**
 * GC-Stats - qualification-resolution
 *
 * Resolves `stage_qualifications` rules once a container/match finishes:
 * records `qualification_results` and fills any waiting `match_seeds`,
 * the group-shaped counterpart to bracket-edge propagation.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { stageQualifications, qualificationResults, matches, stageContainers } from "@gc-stats/db";
import type { Tx } from "./repository";
import { findGroupRankSeeds, findQualificationSeeds, fillMatchSlotFromSeed } from "./repository";
import { computeContainerStandings } from "./standings";

async function recordQualification(tx: Tx, qualificationId: number, entrantId: number, rank: number | null): Promise<void> {
  await tx
    .insert(qualificationResults)
    .values({ qualificationId, entrantId, rank })
    .onConflictDoNothing();
}

/**
 * Resolves every `stage_qualifications` rule anchored on a container that
 * just finished (rank-based: "top N of this group advance"). For each rank
 * in range, records the `qualification_results` row and, if the rule
 * targets another container, fills any `match_seeds` waiting on that exact
 * (containerId, rank) pair — the group-shaped counterpart to
 * `resolveMatchInGraph`'s bracket-edge propagation.
 */
export async function resolveContainerRankQualifications(tx: Tx, container: typeof stageContainers.$inferSelect): Promise<void> {
  const rules = await tx.select().from(stageQualifications).where(eq(stageQualifications.sourceContainerId, container.id));
  if (rules.length === 0) return;

  const standings = await computeContainerStandings(tx, container.id, container.config);

  for (const rule of rules) {
    const from = rule.rankFrom ?? 1;
    const to = rule.rankTo ?? from;
    for (let rank = from; rank <= to; rank++) {
      const entry = standings.find((s) => s.rank === rank);
      if (!entry) continue;
      const entrantId = Number(entry.id);

      await recordQualification(tx, rule.id, entrantId, rank);

      if (rule.destinationType === "container") {
        const seeds = await findGroupRankSeeds(tx, container.id, rank);
        for (const seed of seeds) {
          await fillMatchSlotFromSeed(tx, seed.matchId, seed.slot, entrantId);
        }
      }
    }
  }
}

/**
 * Resolves `stage_qualifications` rules anchored on a specific match
 * outcome (e.g. "loser of the 3rd place decider") for every completed
 * match of a container that just finished.
 */
export async function resolveContainerMatchQualifications(tx: Tx, containerId: number): Promise<void> {
  const containerMatches = await tx.select().from(matches).where(eq(matches.containerId, containerId));
  const matchIds = containerMatches.map((m) => m.id);
  if (matchIds.length === 0) return;

  const rules = await tx.select().from(stageQualifications).where(inArray(stageQualifications.sourceMatchId, matchIds));

  for (const rule of rules) {
    if (!rule.sourceMatchId || !rule.outcome) continue;
    const match = containerMatches.find((m) => m.id === rule.sourceMatchId);
    if (!match || match.status !== "completed" || match.winnerId === null) continue;

    const loserId = match.winnerId === match.entrantAId ? match.entrantBId : match.entrantAId;
    const entrantId = rule.outcome === "winner" ? match.winnerId : loserId;
    if (entrantId === null) continue;

    await recordQualification(tx, rule.id, entrantId, null);

    if (rule.destinationType === "container") {
      const seeds = await findQualificationSeeds(tx, rule.id);
      for (const seed of seeds) {
        await fillMatchSlotFromSeed(tx, seed.matchId, seed.slot, entrantId);
      }
    }
  }
}

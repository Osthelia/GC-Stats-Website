/**
 * GC-Stats — repair-stage-hierarchy
 *
 * One-off repair for tournaments already migrated under the old flattened
 * mapping (every V1 tournament_phase became both its own stage and its own
 * container, parent_id dropped). Not part of the regular migrate-v1 phase
 * list (index.ts): a from-scratch migration goes through the fixed
 * migrateStages() and never creates the wrong rows in the first place.
 *
 * Repoints/renames stage_container rows in place rather than delete and
 * recreate, since matches.container_id already points at them, so this
 * causes zero churn on matches/maps/game-stats/vetos. Verified via
 * analyze() (dry run, read only) before writing: only 6 stale zero-match
 * containers are still referenced elsewhere (stage_qualifications) and are
 * left in place; everything else analyze() reports safe is removed.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, sql } from "drizzle-orm";
import { db, v1 } from "./connection";
import { preloadEntityType, tryMappedId } from "./id-map";
import { resolvePhaseTree, type V1Phase } from "./phase-tree";
import {
  stages, stageContainers, matches, groupEntries, containerStandingsRules,
  stageQualifications, forumThreads,
} from "../../src/schema";

function normalizeGroupFormat(format: string | null): "round_robin" | "swiss" {
  return format === "round_robin" ? "round_robin" : "swiss";
}

async function isContainerSafeToDelete(containerId: number): Promise<boolean> {
  if (await db.$count(matches, eq(matches.containerId, containerId))) return false;
  if (await db.$count(groupEntries, eq(groupEntries.containerId, containerId))) return false;
  if (await db.$count(containerStandingsRules, eq(containerStandingsRules.containerId, containerId))) return false;
  if (await db.$count(stageQualifications, sql`${stageQualifications.sourceContainerId} = ${containerId} OR ${stageQualifications.destinationContainerId} = ${containerId}`)) return false;
  if (await db.$count(forumThreads, and(eq(forumThreads.subjectType, "phase_as_container"), eq(forumThreads.subjectId, containerId)))) return false;
  return true;
}

export async function repairStageHierarchy() {
  const [phaseRows] = await v1.query<any[]>(
    "SELECT id, parent_id, tournament_id, name, format, `order` FROM tournament_phases"
  );
  const [matchPhaseRows] = await v1.query<any[]>("SELECT DISTINCT phase_id FROM matches");
  const phaseIdsWithMatches = new Set((matchPhaseRows as any[]).map((r) => r.phase_id as number));
  const plan = resolvePhaseTree(phaseRows as V1Phase[], phaseIdsWithMatches);

  await preloadEntityType("phase_as_stage");
  await preloadEntityType("phase_as_container");

  const containerPlanByLeaf = new Map(plan.containers.map((c) => [c.leafPhaseId, c]));
  const newStagePhaseIds = new Set(plan.stages.map((s) => s.phaseId));

  let repointed = 0, containersDeleted = 0, containersKeptReferenced = 0;
  let stagesDeleted = 0, stagesKeptNonEmpty = 0;

  for (const c of plan.containers) {
    const containerId = tryMappedId("phase_as_container", c.leafPhaseId);
    const stageId = tryMappedId("phase_as_stage", c.stagePhaseId);
    if (!containerId || !stageId) continue; // not migrated yet — leave for the regular phase to create
    await db.update(stageContainers).set({
      stageId,
      name: c.name,
      containerType: c.isGroup ? "group" : "bracket",
      config: c.isGroup ? { type: normalizeGroupFormat(c.format) } : {},
    }).where(eq(stageContainers.id, containerId));
    repointed++;
  }

  for (const p of phaseRows as any[]) {
    if (containerPlanByLeaf.has(p.id)) continue; // handled above
    const containerId = tryMappedId("phase_as_container", p.id);
    if (!containerId) continue;
    if (await isContainerSafeToDelete(containerId)) {
      await db.delete(stageContainers).where(eq(stageContainers.id, containerId));
      containersDeleted++;
    } else {
      containersKeptReferenced++;
      console.log(`kept stale container ${containerId} (V1 phase ${p.id}, "${p.name}") — referenced elsewhere`);
    }
  }

  for (const p of phaseRows as any[]) {
    if (newStagePhaseIds.has(p.id)) continue; // meant to stay a stage
    const stageId = tryMappedId("phase_as_stage", p.id);
    if (!stageId) continue;
    const remainingContainers = await db.$count(stageContainers, eq(stageContainers.stageId, stageId));
    if (remainingContainers === 0) {
      await db.delete(stages).where(eq(stages.id, stageId));
      stagesDeleted++;
    } else {
      stagesKeptNonEmpty++;
      console.log(`kept stale stage ${stageId} (V1 phase ${p.id}, "${p.name}") — still has ${remainingContainers} container(s)`);
    }
  }

  console.log(
    `repair: ${repointed} containers repointed/renamed, ${containersDeleted} stale containers deleted, ` +
    `${containersKeptReferenced} stale containers kept (referenced elsewhere), ` +
    `${stagesDeleted} stale stages deleted, ${stagesKeptNonEmpty} stale stages kept (not empty)`
  );
}

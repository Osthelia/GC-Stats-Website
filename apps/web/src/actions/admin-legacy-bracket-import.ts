/**
 * GC-Stats - admin-legacy-bracket-import
 *
 * Admin server actions for importing legacy (V1) brackets: generates the
 * same container/graph shapes as admin-bracket-editor but leaves every slot
 * TBD, tagging containers as legacy import targets. Kept separate from
 * generateBracketFromTemplate since it runs on stages that already have
 * real matches, so its guards differ.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq, and } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stages, stageContainers, matches, bracketEdges } from "@gc-stats/db";
import {
  generateSingleElimination,
  generateDoubleElimination,
  generateTripleElimination,
  generateRoundRobin,
  generateGslGroup,
  validateGraph,
  type BracketGraph,
} from "@gc-stats/bracket-engine";
import { persistGeneratedGraph } from "@/lib/bracket/repository";
import { labelBracketTiers, type BracketTier } from "@/lib/bracket-naming";
import { requireTournamentsActor, type BracketFormat } from "./admin-bracket-editor";

export type GenerateLegacyShapeInput = {
  stageId: number;
  format: BracketFormat;
  bestOf: number;
  grandFinalBestOf: number;
  slotCount: number;
};

export type GenerateLegacyShapeResult = { ok: true } | { ok: false; error: string };

/**
 * Same container/graph generation as `generateBracketFromTemplate`
 * (single/double/triple elim, round robin, GSL) but every slot is left TBD
 * (no entrant, no resolveSeedSlots) and containers are tagged
 * `legacyImportTarget: true` in their config — assignLegacyMatchToSlot only
 * ever writes into a container carrying this flag. Deliberately NOT sharing
 * code with generateBracketFromTemplate (own guards: no "stage pending"
 * check, no whole-stage "already generated" check — a legacy import always
 * runs on a stage that already has real matches in its migrated container)
 * to avoid destabilizing that already-hardened path for a second, different
 * set of guarantees.
 */
export async function generateLegacyBracketShape(input: GenerateLegacyShapeInput): Promise<GenerateLegacyShapeResult> {
  await requireTournamentsActor();

  const [stage] = await db.select().from(stages).where(eq(stages.id, input.stageId));
  if (!stage) return { ok: false, error: "stageNotFound" };

  const entrantCount = input.slotCount;
  if (entrantCount < 2) return { ok: false, error: "notEnoughEntrants" };
  if (input.format === "triple_elimination" && entrantCount < 3) return { ok: false, error: "notEnoughEntrantsTriple" };
  if (input.format === "gsl_group" && entrantCount !== 4) return { ok: false, error: "gslRequiresFour" };
  if (!Number.isInteger(input.bestOf) || input.bestOf < 1) return { ok: false, error: "invalidBestOf" };
  if (!Number.isInteger(input.grandFinalBestOf) || input.grandFinalBestOf < 1) return { ok: false, error: "invalidBestOf" };

  async function makeContainer(name: string, containerType: "bracket" | "group" = "bracket", config: Record<string, unknown> = {}) {
    const [row] = await db
      .insert(stageContainers)
      .values({ stageId: input.stageId, name, containerType, config: { ...config, legacyImportTarget: true } })
      .returning({ id: stageContainers.id });
    if (!row) throw new Error("container insert failed");
    return row.id;
  }

  let graph: BracketGraph;
  let containerIdMap: Record<string, number>;
  let tierByContainerId: Partial<Record<string, BracketTier>> = {};

  if (input.format === "single_elimination") {
    const bracketId = await makeContainer("Bracket");
    containerIdMap = { bracket: bracketId };
    tierByContainerId = { bracket: "solo" };
    graph = generateSingleElimination({ containerId: "bracket", entrantCount, bestOf: input.bestOf });
  } else if (input.format === "double_elimination") {
    // Sequential creation order matters — cf. generateBracketFromTemplate.
    const upperId = await makeContainer("Upper Bracket");
    const lowerId = await makeContainer("Lower Bracket");
    const gfId = await makeContainer("Grand Final");
    containerIdMap = { upper: upperId, lower: lowerId, gf: gfId };
    tierByContainerId = { upper: "upper", lower: "lower" };
    graph = generateDoubleElimination({ upperContainerId: "upper", lowerContainerId: "lower", grandFinalContainerId: "gf", entrantCount, bestOf: input.bestOf, grandFinalBestOf: input.grandFinalBestOf });
  } else if (input.format === "triple_elimination") {
    const upperId = await makeContainer("Upper Bracket");
    const middleId = await makeContainer("Middle Bracket");
    const lowerId = await makeContainer("Lower Bracket");
    const gfId = await makeContainer("Finals");
    containerIdMap = { upper: upperId, middle: middleId, lower: lowerId, gf: gfId };
    tierByContainerId = { upper: "upper", middle: "middle", lower: "lower" };
    graph = generateTripleElimination({
      upperContainerId: "upper",
      middleContainerId: "middle",
      lowerContainerId: "lower",
      grandFinalContainerId: "gf",
      entrantCount,
      bestOf: input.bestOf,
      grandFinalBestOf: input.grandFinalBestOf,
    });
  } else if (input.format === "round_robin" || input.format === "round_robin_double") {
    const groupId = await makeContainer("Round Robin", "group", { type: "round_robin", tiebreakers: ["round_diff", "head_to_head", "seed"], pointsConfig: null });
    containerIdMap = { group: groupId };
    graph = generateRoundRobin({ containerId: "group", entrantCount, bestOf: input.bestOf, double: input.format === "round_robin_double" });
  } else {
    const groupId = await makeContainer("GSL Group", "bracket");
    containerIdMap = { group: groupId };
    graph = generateGslGroup({ containerId: "group", bestOf: input.bestOf, deciderBestOf: input.grandFinalBestOf });
  }

  if (Object.keys(tierByContainerId).length > 0) {
    graph = labelBracketTiers(graph, tierByContainerId);
  }

  const validation = validateGraph(graph);
  if (!validation.valid) {
    throw new Error(`generateLegacyBracketShape: generator produced an invalid graph: ${validation.errors.join("; ")}`);
  }

  await persistGeneratedGraph(containerIdMap, graph);

  return { ok: true };
}

type MatchOwnership = { id: number; containerId: number; status: "pending" | "live" | "completed"; entrantAId: number | null; entrantBId: number | null; round: number; displayOrder: number | null; label: string | null; bestOf: number };

async function loadMatchWithContainer(matchId: number, stageId: number): Promise<{ match: MatchOwnership; isTarget: boolean } | null> {
  const [row] = await db
    .select({
      id: matches.id,
      containerId: matches.containerId,
      status: matches.status,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      round: matches.round,
      displayOrder: matches.displayOrder,
      label: matches.label,
      bestOf: matches.bestOf,
      config: stageContainers.config,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(matches.containerId, stageContainers.id))
    .where(and(eq(matches.id, matchId), eq(stageContainers.stageId, stageId)));
  if (!row) return null;
  const isTarget = (row.config as { legacyImportTarget?: boolean } | null)?.legacyImportTarget === true;
  return { match: { id: row.id, containerId: row.containerId, status: row.status, entrantAId: row.entrantAId, entrantBId: row.entrantBId, round: row.round, displayOrder: row.displayOrder, label: row.label, bestOf: row.bestOf }, isTarget };
}

export type AssignLegacyMatchInput = { stageId: number; sourceMatchId: number; targetMatchId: number };
export type AssignLegacyMatchResult = { ok: true } | { ok: false; error: string };

/**
 * Re-parents an already-migrated match into an empty target slot — never
 * deletes/recreates the source match (its id, and everything FK'd to it —
 * maps, vetos, stats — stays untouched), only its containerId/round/
 * displayOrder move. The target placeholder (never played, always
 * status='pending' with both slots empty) is deleted after any edges
 * pointing at it are repointed to the real match taking its place.
 */
export async function assignLegacyMatchToSlot(input: AssignLegacyMatchInput): Promise<AssignLegacyMatchResult> {
  await requireTournamentsActor();

  if (input.sourceMatchId === input.targetMatchId) return { ok: false, error: "sameMatch" };

  const source = await loadMatchWithContainer(input.sourceMatchId, input.stageId);
  if (!source) return { ok: false, error: "notFound" };
  const target = await loadMatchWithContainer(input.targetMatchId, input.stageId);
  if (!target) return { ok: false, error: "notFound" };

  if (!target.isTarget) return { ok: false, error: "targetNotEmpty" };
  if (target.match.status !== "pending" || target.match.entrantAId !== null || target.match.entrantBId !== null) {
    return { ok: false, error: "targetNotEmpty" };
  }

  await db.transaction(async (tx) => {
    await tx.update(bracketEdges).set({ fromMatchId: source.match.id }).where(eq(bracketEdges.fromMatchId, target.match.id));
    await tx.update(bracketEdges).set({ toMatchId: source.match.id }).where(eq(bracketEdges.toMatchId, target.match.id));
    await tx
      .update(matches)
      .set({ containerId: target.match.containerId, round: target.match.round, displayOrder: target.match.displayOrder, label: source.match.label ?? target.match.label })
      .where(eq(matches.id, source.match.id));
    await tx.delete(matches).where(eq(matches.id, target.match.id));
  });

  return { ok: true };
}

export type UnassignLegacyMatchInput = { stageId: number; matchId: number };
export type UnassignLegacyMatchResult = { ok: true } | { ok: false; error: string };

/** Reverse of assignLegacyMatchToSlot: sends a placed match back to the
 *  pool, leaving a fresh empty placeholder in the target slot it vacates so
 *  the generated shape stays complete and droppable. */
export async function unassignLegacyMatch(input: UnassignLegacyMatchInput): Promise<UnassignLegacyMatchResult> {
  await requireTournamentsActor();

  const placed = await loadMatchWithContainer(input.matchId, input.stageId);
  if (!placed) return { ok: false, error: "notFound" };
  if (!placed.isTarget) return { ok: false, error: "notAssigned" };

  const poolContainers = await db.select({ id: stageContainers.id, config: stageContainers.config }).from(stageContainers).where(eq(stageContainers.stageId, input.stageId));
  const pool = poolContainers.find((c) => (c.config as { legacyImportTarget?: boolean } | null)?.legacyImportTarget !== true);
  if (!pool) return { ok: false, error: "noPoolContainer" };

  await db.transaction(async (tx) => {
    const [placeholder] = await tx
      .insert(matches)
      .values({ containerId: placed.match.containerId, round: placed.match.round, displayOrder: placed.match.displayOrder, label: placed.match.label, bestOf: placed.match.bestOf, status: "pending" })
      .returning({ id: matches.id });
    if (!placeholder) throw new Error("unassignLegacyMatch: placeholder insert failed");

    await tx.update(bracketEdges).set({ fromMatchId: placeholder.id }).where(eq(bracketEdges.fromMatchId, placed.match.id));
    await tx.update(bracketEdges).set({ toMatchId: placeholder.id }).where(eq(bracketEdges.toMatchId, placed.match.id));
    await tx.update(matches).set({ containerId: pool.id, displayOrder: null }).where(eq(matches.id, placed.match.id));
  });

  return { ok: true };
}

// --- Target structure editing (add/move/delete matches, connect/disconnect
// edges) — the generated shape is a starting point, not final: an admin
// often needs an extra round or a wrong best-of fixed once they see the real
// matches. Every action here is scoped to containers carrying
// legacyImportTarget=true (never touches the pool's migrated containers) and
// is a single atomic write, never a full-replace — a target container can
// hold already re-parented real matches (id, maps, stats) at any time, so
// nothing here may ever delete/recreate a match wholesale the way
// saveManualGraph does. -------------------------------------------------

async function isLegacyTargetContainer(containerId: number, stageId: number): Promise<boolean> {
  const [row] = await db
    .select({ config: stageContainers.config })
    .from(stageContainers)
    .where(and(eq(stageContainers.id, containerId), eq(stageContainers.stageId, stageId)));
  if (!row) return false;
  return (row.config as { legacyImportTarget?: boolean } | null)?.legacyImportTarget === true;
}

export type AddLegacyTargetMatchInput = { stageId: number; containerId: number; round: number; bestOf: number };
export type AddLegacyTargetMatchResult = { ok: true } | { ok: false; error: string };

/** Adds one empty (TBD) match to an already-generated target container —
 *  the generated template is a starting point, this covers "I need one
 *  more round" or "there was an extra decider match" once the admin sees
 *  the real matches they're placing. */
export async function addLegacyTargetMatch(input: AddLegacyTargetMatchInput): Promise<AddLegacyTargetMatchResult> {
  await requireTournamentsActor();

  if (!Number.isInteger(input.round) || input.round < 1) return { ok: false, error: "invalidRound" };
  if (!Number.isInteger(input.bestOf) || input.bestOf < 1) return { ok: false, error: "invalidBestOf" };
  if (!(await isLegacyTargetContainer(input.containerId, input.stageId))) return { ok: false, error: "containerNotFound" };

  await db.insert(matches).values({ containerId: input.containerId, round: input.round, bestOf: input.bestOf, status: "pending" });
  return { ok: true };
}

export type DeleteLegacyTargetMatchInput = { stageId: number; matchId: number };
export type DeleteLegacyTargetMatchResult = { ok: true } | { ok: false; error: string };

/** Deletes an empty (TBD, never played) slot from a target container. A
 *  slot holding an already re-parented real match must go through
 *  unassignLegacyMatch first — this never deletes a real match. */
export async function deleteLegacyTargetMatch(input: DeleteLegacyTargetMatchInput): Promise<DeleteLegacyTargetMatchResult> {
  await requireTournamentsActor();

  const loaded = await loadMatchWithContainer(input.matchId, input.stageId);
  if (!loaded) return { ok: false, error: "notFound" };
  if (!loaded.isTarget) return { ok: false, error: "notAssigned" };
  if (loaded.match.status !== "pending" || loaded.match.entrantAId !== null || loaded.match.entrantBId !== null) {
    return { ok: false, error: "matchNotEmpty" };
  }

  await db.delete(matches).where(eq(matches.id, input.matchId));
  return { ok: true };
}

export type MoveLegacyTargetMatchInput = { stageId: number; matchId: number; round: number; displayOrder: number | null };
export type MoveLegacyTargetMatchResult = { ok: true } | { ok: false; error: string };

/** Repositions a target slot (round/displayOrder only) — purely structural,
 *  allowed whether the slot is still TBD or already holds a re-parented
 *  real match (never touches entrants/score/container). Backs drag-to-move
 *  in the target canvas. */
export async function moveLegacyTargetMatch(input: MoveLegacyTargetMatchInput): Promise<MoveLegacyTargetMatchResult> {
  await requireTournamentsActor();

  if (!Number.isInteger(input.round) || input.round < 1) return { ok: false, error: "invalidRound" };

  const loaded = await loadMatchWithContainer(input.matchId, input.stageId);
  if (!loaded) return { ok: false, error: "notFound" };
  if (!loaded.isTarget) return { ok: false, error: "notAssigned" };

  await db.update(matches).set({ round: input.round, displayOrder: input.displayOrder }).where(eq(matches.id, input.matchId));
  return { ok: true };
}

export type ConnectLegacyEdgeInput = { stageId: number; fromMatchId: number; fromResult: "winner" | "loser"; toMatchId: number; toSlot: "a" | "b" };
export type ConnectLegacyEdgeResult = { ok: true } | { ok: false; error: string };

/** Connects two target slots (decorative lineage only in this tool — no
 *  resolveMatch is ever triggered here, cf. generateLegacyBracketShape doc
 *  comment). Replaces any existing edge already feeding the same target
 *  slot, mirroring the normal editor's onConnect behavior. */
export async function connectLegacyEdge(input: ConnectLegacyEdgeInput): Promise<ConnectLegacyEdgeResult> {
  await requireTournamentsActor();

  if (input.fromMatchId === input.toMatchId) return { ok: false, error: "sameMatch" };
  const from = await loadMatchWithContainer(input.fromMatchId, input.stageId);
  if (!from) return { ok: false, error: "notFound" };
  const to = await loadMatchWithContainer(input.toMatchId, input.stageId);
  if (!to) return { ok: false, error: "notFound" };
  if (!from.isTarget || !to.isTarget) return { ok: false, error: "notAssigned" };

  await db.transaction(async (tx) => {
    await tx.delete(bracketEdges).where(and(eq(bracketEdges.toMatchId, input.toMatchId), eq(bracketEdges.toSlot, input.toSlot)));
    await tx.insert(bracketEdges).values({ fromMatchId: input.fromMatchId, fromResult: input.fromResult, toMatchId: input.toMatchId, toSlot: input.toSlot });
  });
  return { ok: true };
}

export type DisconnectLegacyEdgeInput = { stageId: number; fromMatchId: number; fromResult: "winner" | "loser"; toMatchId: number; toSlot: "a" | "b" };
export type DisconnectLegacyEdgeResult = { ok: true } | { ok: false; error: string };

export async function disconnectLegacyEdge(input: DisconnectLegacyEdgeInput): Promise<DisconnectLegacyEdgeResult> {
  await requireTournamentsActor();

  const to = await loadMatchWithContainer(input.toMatchId, input.stageId);
  if (!to || !to.isTarget) return { ok: false, error: "notFound" };

  await db
    .delete(bracketEdges)
    .where(and(eq(bracketEdges.fromMatchId, input.fromMatchId), eq(bracketEdges.fromResult, input.fromResult), eq(bracketEdges.toMatchId, input.toMatchId), eq(bracketEdges.toSlot, input.toSlot)));
  return { ok: true };
}


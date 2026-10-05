/**
 * GC-Stats - admin-bracket-editor
 *
 * Admin server actions for the tournament bracket editor: generating a
 * bracket graph from a template (single/double/triple elimination, round
 * robin, GSL group) via the bracket-engine package, then persisting it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq, inArray, asc, and } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stages, stageContainers, matches, matchSeeds, groupEntries, entrants, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import {
  generateSingleElimination,
  generateDoubleElimination,
  generateTripleElimination,
  generateRoundRobin,
  generateGslGroup,
  validateGraph,
  pairRound,
  type BracketGraph,
  type SwissEntrant,
} from "@gc-stats/bracket-engine";
import { persistGeneratedGraph } from "@/lib/bracket/repository";
import { parseGroupConfig } from "@/lib/bracket/config-types";
import { labelBracketTiers, type BracketTier } from "@/lib/bracket-naming";
import { validateEditorGraph } from "@/lib/bracket-editor-validation";
import { parseIsoInstant } from "@/lib/datetime-local";

export async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

export type BracketFormat = "single_elimination" | "double_elimination" | "triple_elimination" | "round_robin" | "round_robin_double" | "gsl_group";

export type GenerateTemplateInput = {
  stageId: number;
  format: BracketFormat;
  bestOf: number;
  grandFinalBestOf: number;
  /** Entrant ids IN SEED ORDER (index 0 = seed 1, etc.) — the generator only knows seed numbers, never db ids, until persistence remaps them. `null` leaves that slot unassigned (TBD), same as a manually added editor match with no seed — filled in later from the editor or the match edit page. */
  entrantIdsBySeed: (number | null)[];
};

export type GenerateTemplateResult = { ok: true } | { ok: false; error: string };

export async function generateBracketFromTemplate(input: GenerateTemplateInput): Promise<GenerateTemplateResult> {
  await requireTournamentsActor();

  const [stage] = await db.select().from(stages).where(eq(stages.id, input.stageId));
  if (!stage) return { ok: false, error: "stageNotFound" };
  if (stage.status !== "pending") return { ok: false, error: "stageNotPending" };

  const entrantCount = input.entrantIdsBySeed.length;
  if (entrantCount < 2) return { ok: false, error: "notEnoughEntrants" };
  if (input.format === "triple_elimination" && entrantCount < 3) return { ok: false, error: "notEnoughEntrantsTriple" };
  if (input.format === "gsl_group" && entrantCount !== 4) return { ok: false, error: "gslRequiresFour" };
  if (!Number.isInteger(input.bestOf) || input.bestOf < 1) return { ok: false, error: "invalidBestOf" };
  if (!Number.isInteger(input.grandFinalBestOf) || input.grandFinalBestOf < 1) return { ok: false, error: "invalidBestOf" };

  const existingContainers = await db.select({ id: stageContainers.id }).from(stageContainers).where(eq(stageContainers.stageId, input.stageId));
  if (existingContainers.length > 0) {
    const containerIds = existingContainers.map((c) => c.id);
    const [anyMatch] = await db.select({ id: matches.id }).from(matches).where(inArray(matches.containerId, containerIds)).limit(1);
    if (anyMatch) return { ok: false, error: "alreadyGenerated" };
  }

  // Build the containers this format needs, get their real ids, then hand
  // the id map to the generator/repository — same shared function whether
  // this graph comes from a template or (eventually) the visual editor.
  async function makeContainer(name: string, containerType: "bracket" | "group" = "bracket", config: Record<string, unknown> = {}) {
    const [row] = await db.insert(stageContainers).values({ stageId: input.stageId, name, containerType, config }).returning({ id: stageContainers.id });
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
    // Sequential, not Promise.all: the bracket layout algorithm
    // (lib/bracket-layout.ts) orders lanes by container creation order
    // (their auto-incremented id), so issuing these concurrently risked
    // Lower getting a lower id than Upper on some execution interleavings
    // — a real bug hit in this exact form (2026-08-31), not hypothetical.
    const upperId = await makeContainer("Upper Bracket");
    const lowerId = await makeContainer("Lower Bracket");
    const gfId = await makeContainer("Grand Final");
    containerIdMap = { upper: upperId, lower: lowerId, gf: gfId };
    tierByContainerId = { upper: "upper", lower: "lower" };
    graph = generateDoubleElimination({ upperContainerId: "upper", lowerContainerId: "lower", grandFinalContainerId: "gf", entrantCount, bestOf: input.bestOf, grandFinalBestOf: input.grandFinalBestOf });
  } else if (input.format === "triple_elimination") {
    // Sequential — same reasoning as double elimination above, this is the
    // format where the bug actually surfaced (Middle/Lower swapped).
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
    // A bare `{}` config here left `parseGroupConfig` unable to tell this
    // container's format from its config's "type" discriminant — the
    // resulting `Error` bubbled all the way up to the public tournament
    // page and made it 500 (found 2026-09-12 auditing why real migrated
    // tournaments' pages were crashing; this is the still-live code path,
    // not just old migrated data — see SUIVI.md).
    const groupId = await makeContainer("Round Robin", "group", { type: "round_robin", tiebreakers: ["round_diff", "head_to_head", "seed"], pointsConfig: null });
    containerIdMap = { group: groupId };
    graph = generateRoundRobin({ containerId: "group", entrantCount, bestOf: input.bestOf, double: input.format === "round_robin_double" });
  } else {
    const groupId = await makeContainer("GSL Group", "bracket");
    containerIdMap = { group: groupId };
    graph = generateGslGroup({ containerId: "group", bestOf: input.bestOf, deciderBestOf: input.grandFinalBestOf });
  }

  // Configurable naming scheme (2026-08-31, explicit user spec) — applied
  // as a post-processing step over the generator's own graph rather than
  // baked into the generator itself, so the engine stays presentation-
  // agnostic and a future site can swap in its own scheme here without
  // touching packages/bracket-engine. No-op for containers not listed in
  // `tierByContainerId` (GSL/round-robin, and the grand-final container,
  // which keeps the label the generator already gave it).
  if (Object.keys(tierByContainerId).length > 0) {
    graph = labelBracketTiers(graph, tierByContainerId);
  }

  const validation = validateGraph(graph);
  if (!validation.valid) {
    // Would indicate a real bug in the engine, not a user input problem —
    // surfaced distinctly rather than as a normal field error.
    throw new Error(`generateBracketFromTemplate: generator produced an invalid graph: ${validation.errors.join("; ")}`);
  }

  // Remap generator seed numbers (1..N) to the real entrant ids the admin
  // selected, in order — a `null` entry (no entrant picked for that seed)
  // drops the seed source entirely, leaving the slot unfed (TBD), same
  // convention as an unset slot in the manual editor. Done *after*
  // `validateGraph` above, which only ever sees the generator's own
  // placeholder seed numbers (always present), so an unassigned slot here
  // never trips the "unfed slot" check meant to catch real generator bugs.
  const graphWithRealSeeds: BracketGraph = {
    ...graph,
    matches: graph.matches.map((m) => ({
      ...m,
      seeds: m.seeds.flatMap((s) => {
        if (s.source.type !== "seed") return [s];
        const entrantId = input.entrantIdsBySeed[s.source.seed - 1] ?? null;
        if (entrantId === null) return [];
        return [{ ...s, source: { type: "seed" as const, seed: entrantId } }];
      }),
    })),
  };

  await persistGeneratedGraph(containerIdMap, graphWithRealSeeds);
  await resolveSeedSlots(Object.values(containerIdMap));

  return { ok: true };
}

/**
 * The persisted `match_seeds` rows of type "seed" carry the real entrant id
 * directly in `sourceRef.seed` (already remapped from a seed NUMBER to a
 * real entrant id by the caller) rather than a bracket-edge propagation —
 * resolve those straight into entrantAId/entrantBId so round-1 matches are
 * immediately playable. Shared by template generation and the manual
 * editor's save, both of which end with a freshly persisted graph in this
 * same shape.
 */
async function resolveSeedSlots(containerIds: number[]): Promise<void> {
  const insertedMatches = await db.select().from(matches).where(inArray(matches.containerId, containerIds));
  const insertedSeeds = await db.select().from(matchSeeds).where(inArray(matchSeeds.matchId, insertedMatches.map((m) => m.id)));
  for (const seedRow of insertedSeeds) {
    if (seedRow.sourceType !== "seed") continue;
    const entrantId = (seedRow.sourceRef as { seed: number }).seed;
    if (entrantId < 0) continue; // defensive: shouldn't happen, callers validate seeds cover every real entrant
    const column = seedRow.slot === "a" ? { entrantAId: entrantId } : { entrantBId: entrantId };
    await db.update(matches).set(column).where(eq(matches.id, seedRow.matchId));
  }
}

export type StartSwissRoundResult = { ok: true } | { ok: false; error: string };

/** Bootstraps round 1 of a Swiss group (there's no static graph to
 *  generate — every later round is created by `advanceSwissGroup`, cf.
 *  Phase 2, once a match resolves; this is the one-time kickoff). */
export async function startSwissRound1(containerId: number): Promise<StartSwissRoundResult> {
  await requireTournamentsActor();

  const [container] = await db.select().from(stageContainers).where(eq(stageContainers.id, containerId));
  if (!container) return { ok: false, error: "notFound" };
  if (container.containerType !== "group") return { ok: false, error: "notAGroup" };

  const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(eq(matches.containerId, containerId)).limit(1);
  if (existingMatch) return { ok: false, error: "alreadyStarted" };

  const config = parseGroupConfig(container.config);
  if (config.type !== "swiss") return { ok: false, error: "notSwiss" };

  const entries = await db.select().from(groupEntries).where(eq(groupEntries.containerId, containerId)).orderBy(asc(groupEntries.seed));
  if (entries.length < 2) return { ok: false, error: "notEnoughEntrants" };

  const dtos: SwissEntrant[] = entries.map((e) => ({ id: String(e.entrantId), seed: e.seed ?? 0, wins: 0, losses: 0, buchholz: 0, roundDiff: 0, hadBye: false, status: "active" }));
  const result = pairRound({ round: 1, entrants: dtos, history: [], config });

  for (const pairing of result.pairings) {
    if (pairing.bId === null) {
      await db.update(groupEntries).set({ wins: 1, hadBye: true }).where(eq(groupEntries.entrantId, Number(pairing.aId)));
      continue;
    }
    await db.insert(matches).values({ containerId, round: 1, bestOf: result.bestOf, status: "pending", entrantAId: Number(pairing.aId), entrantBId: Number(pairing.bId) });
  }

  await db.update(stageContainers).set({ status: "active" }).where(eq(stageContainers.id, containerId));
  return { ok: true };
}

export type DeleteBracketMatchesResult = { ok: true } | { ok: false; error: string };

/** Wipes generated matches/edges/seeds for a container so it can be
 *  regenerated — only while the container has no completed matches
 *  (cascades from `matches` handle edges/seeds). */
export async function resetContainer(containerId: number, stageId: number): Promise<DeleteBracketMatchesResult> {
  await requireTournamentsActor();

  const [container] = await db.select({ id: stageContainers.id }).from(stageContainers).where(and(eq(stageContainers.id, containerId), eq(stageContainers.stageId, stageId))).limit(1);
  if (!container) return { ok: false, error: "notFound" };

  const containerMatches = await db.select().from(matches).where(eq(matches.containerId, containerId));
  if (containerMatches.some((m) => m.status === "completed" || m.status === "live")) {
    return { ok: false, error: "hasResults" };
  }

  // bracket_edges/match_seeds cascade from `matches` (ON DELETE CASCADE) —
  // no need to delete them separately.
  await db.delete(matches).where(eq(matches.containerId, containerId));
  await db.delete(groupEntries).where(eq(groupEntries.containerId, containerId));
  await db.update(stageContainers).set({ status: "pending" }).where(eq(stageContainers.id, containerId));

  return { ok: true };
}

// --- Manual visual editor save -------------------------------------------

export type EditorSlotSource =
  | { type: "entrant"; entrantId: number }
  | { type: "bye" }
  | { type: "edge" }
  // Deliberately not yet assigned (TBD) — no seed, no incoming edge. Valid to
  // save (cf. lib/bracket-editor-validation.ts): entrantAId/entrantBId stay
  // null in DB, to be filled in later from the match edit page.
  | { type: "unset" };

export type EditorSaveMatch = {
  /** Client-side id: a real match id (as a string) for a match kept from
   *  before, or "new-<n>" for one created in this editing session — the
   *  distinction doesn't matter to the server, every match here is
   *  re-inserted fresh (full-replace save, see below). */
  id: string;
  containerId: number;
  round: number;
  /** Row within (containerId, round) as currently drawn in the editor — persisted as `matches.display_order` so a match manually left on an empty row (e.g. row 1 then row 3, skipping row 2) reloads at that same row instead of collapsing back to the next free one. */
  displayOrder: number;
  label: string | null;
  bestOf: number;
  slotA: EditorSlotSource;
  slotB: EditorSlotSource;
};

export type EditorSaveEdge = { fromMatchId: string; fromResult: "winner" | "loser"; toMatchId: string; toSlot: "a" | "b" };

export type SaveManualGraphInput = { stageId: number; containerIds: number[]; matches: EditorSaveMatch[]; edges: EditorSaveEdge[] };
export type SaveManualGraphResult = { ok: true } | { ok: false; error: string; validationErrors?: string[] };

/**
 * Full-replace save of the visual editor's current canvas state: validates
 * the graph shape (same `validateGraph` the generators are held to — no
 * orphan slot, no cycle) before touching anything, then deletes every
 * existing match in the edited containers and re-inserts the graph exactly
 * as drawn. Only allowed while the stage is pending and none of its matches
 * is live or completed: the full replace would wipe their results and stats.
 */
export async function saveManualGraph(input: SaveManualGraphInput): Promise<SaveManualGraphResult> {
  await requireTournamentsActor();

  const [stage] = await db.select().from(stages).where(eq(stages.id, input.stageId));
  if (!stage) return { ok: false, error: "stageNotFound" };
  if (stage.status !== "pending") return { ok: false, error: "stageNotPending" };

  if (input.containerIds.length > 0) {
    const ownedContainers = await db
      .select({ id: stageContainers.id })
      .from(stageContainers)
      .where(and(inArray(stageContainers.id, input.containerIds), eq(stageContainers.stageId, input.stageId)));
    if (ownedContainers.length !== input.containerIds.length) return { ok: false, error: "containerMismatch" };

    // stages.status stays "pending" until the stage completes, so played matches are the real "started" signal.
    const [playedMatch] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(inArray(matches.containerId, input.containerIds), inArray(matches.status, ["live", "completed"])))
      .limit(1);
    if (playedMatch) return { ok: false, error: "bracketStarted" };
  }

  const entrantIds = new Set<number>();
  for (const m of input.matches) {
    if (m.slotA.type === "entrant") entrantIds.add(m.slotA.entrantId);
    if (m.slotB.type === "entrant") entrantIds.add(m.slotB.entrantId);
  }
  if (entrantIds.size > 0) {
    const ownedEntrants = await db
      .select({ id: entrants.id })
      .from(entrants)
      .where(and(inArray(entrants.id, Array.from(entrantIds)), eq(entrants.tournamentId, stage.tournamentId)));
    if (ownedEntrants.length !== entrantIds.size) return { ok: false, error: "entrantMismatch" };
  }

  const graph: BracketGraph = {
    matches: input.matches.map((m) => ({
      id: m.id,
      containerId: String(m.containerId),
      round: m.round,
      label: m.label ?? undefined,
      bestOf: m.bestOf,
      status: "pending",
      seeds: [
        ...(m.slotA.type === "entrant" ? [{ slot: "a" as const, source: { type: "seed" as const, seed: m.slotA.entrantId } }] : []),
        ...(m.slotA.type === "bye" ? [{ slot: "a" as const, source: { type: "bye" as const } }] : []),
        ...(m.slotB.type === "entrant" ? [{ slot: "b" as const, source: { type: "seed" as const, seed: m.slotB.entrantId } }] : []),
        ...(m.slotB.type === "bye" ? [{ slot: "b" as const, source: { type: "bye" as const } }] : []),
      ],
    })),
    edges: input.edges,
  };

  const validation = validateEditorGraph(graph);
  if (!validation.valid) return { ok: false, error: "invalidGraph", validationErrors: validation.errors };

  const containerIdMap = Object.fromEntries(input.containerIds.map((id) => [String(id), id]));

  await db.delete(matches).where(inArray(matches.containerId, input.containerIds));
  const { matchIdMap } = await persistGeneratedGraph(containerIdMap, graph);
  await resolveSeedSlots(input.containerIds);

  // persistGeneratedGraph only knows the shared engine's MatchNode shape
  // (no displayOrder field) — applied as a second pass here, keyed off the
  // real ids it just handed back.
  for (const m of input.matches) {
    const realId = matchIdMap.get(m.id);
    if (realId === undefined) continue;
    await db.update(matches).set({ displayOrder: m.displayOrder }).where(eq(matches.id, realId));
  }

  return { ok: true };
}

// --- Bulk round scheduling -------------------------------------------------

export type SetRoundScheduledAtResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Sets `scheduledAt` on every match of a given (container, round) at once —
 * the same round is very often played on the same date/time, and doing this
 * one match at a time doesn't scale on a 300-match Swiss or a large bracket
 * (2026-09-11 user request). Purely administrative (like the single-match
 * date field, cf. actions/admin-matches.ts::updateMatchDetails) — allowed
 * regardless of match/container/stage status, never gated on "pending".
 * Only touches matches that already exist in DB (a round the admin hasn't
 * saved yet in the visual editor has no rows to update — `count` reports
 * how many were actually touched so the UI can surface that).
 */
export async function setRoundScheduledAt(containerId: number, stageId: number, round: number, scheduledAtIso: string | null): Promise<SetRoundScheduledAtResult> {
  await requireTournamentsActor();

  if (!Number.isInteger(round) || round < 1) return { ok: false, error: "invalidRound" };

  let scheduledAt: Date | null = null;
  if (scheduledAtIso !== null) {
    scheduledAt = parseIsoInstant(scheduledAtIso);
    if (!scheduledAt) return { ok: false, error: "invalidDate" };
  }

  const [container] = await db.select({ id: stageContainers.id }).from(stageContainers).where(and(eq(stageContainers.id, containerId), eq(stageContainers.stageId, stageId))).limit(1);
  if (!container) return { ok: false, error: "containerNotFound" };

  const updated = await db
    .update(matches)
    .set({ scheduledAt })
    .where(and(eq(matches.containerId, containerId), eq(matches.round, round)))
    .returning({ id: matches.id });

  return { ok: true, count: updated.length };
}

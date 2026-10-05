/**
 * GC-Stats - repository
 *
 * Data access layer for the bracket resolution service: persists generated
 * bracket graphs, resolves seeds and mutates matches, all through a shared
 * `Tx` type that accepts either a real transaction or the plain db client.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
// adminDb: these reads must see writes made moments earlier (Hyperdrive caches `db` for 60s).
import { adminDb as db } from "@gc-stats/db/client";
import { matches, bracketEdges, matchSeeds } from "@gc-stats/db";
import type { BracketGraph, MatchNode, BracketEdge, SeedSource } from "@gc-stats/bracket-engine";

// Drizzle's transaction callback receives a `tx` handle distinct from `db`
// (same shape, different type) — see packages/db/scripts/migrate-v1/id-map.ts
// for the precedent this mirrors. Functions that only ever read (e.g.
// standings.ts, called from public pages with no transaction in progress)
// accept the plain `db` client too — a real transaction is required only
// where callers need atomic multi-statement writes (match-resolution-service).
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/**
 * Persists a generator-produced (or visual-editor-produced) `BracketGraph`
 * into the real schema. The graph's match/container ids are the
 * generator's temporary strings — `containerIdMap` resolves each match's
 * logical `containerId` (e.g. "ub", "lb", "gf" for a double-elim call) to
 * the real `stage_containers.id` it belongs to. A single generator call
 * commonly spans several real containers (upper/lower/grand-final each
 * their own swimlane) or just one (round robin, GSL group) — the caller
 * decides that mapping when it creates the containers, this function only
 * needs it to know where each match row goes.
 *
 * Returns the real DB id for every generator match id, so the caller can
 * resolve `stage_qualifications`/further wiring afterward.
 */
export async function persistGeneratedGraph(
  containerIdMap: Record<string, number>,
  graph: BracketGraph
): Promise<{ matchIdMap: Map<string, number> }> {
  return db.transaction(async (tx) => {
    const matchIdMap = new Map<string, number>();

    for (const match of graph.matches) {
      const realContainerId = containerIdMap[match.containerId];
      if (realContainerId === undefined) {
        throw new Error(`persistGeneratedGraph: no real container mapped for "${match.containerId}"`);
      }
      const [row] = await tx
        .insert(matches)
        .values({
          containerId: realContainerId,
          round: match.round,
          label: match.label ?? null,
          bestOf: match.bestOf,
          // Generators only ever emit "pending" here in practice — this
          // narrows the shared pure package's generic MatchStatus (which
          // still has "ready") down to GC-Stats's own 3-value enum.
          status: match.status === "ready" ? "pending" : match.status,
        })
        .returning({ id: matches.id });
      if (!row) throw new Error(`persistGeneratedGraph: insert of match "${match.id}" returned no row`);
      matchIdMap.set(match.id, row.id);
    }

    if (graph.edges.length > 0) {
      await tx.insert(bracketEdges).values(
        graph.edges.map((edge: BracketEdge) => ({
          fromMatchId: mustResolve(matchIdMap, edge.fromMatchId),
          fromResult: edge.fromResult,
          toMatchId: mustResolve(matchIdMap, edge.toMatchId),
          toSlot: edge.toSlot,
        }))
      );
    }

    const seedRows = graph.matches.flatMap((match: MatchNode) =>
      match.seeds.map((seed) => ({
        matchId: mustResolve(matchIdMap, match.id),
        slot: seed.slot,
        sourceType: seed.source.type,
        sourceRef: remapSeedSourceRef(seed.source, containerIdMap),
      }))
    );
    if (seedRows.length > 0) {
      await tx.insert(matchSeeds).values(seedRows);
    }

    return { matchIdMap };
  });
}

function mustResolve(map: Map<string, number>, generatorId: string): number {
  const id = map.get(generatorId);
  if (id === undefined) throw new Error(`persistGeneratedGraph: unresolved generator match id "${generatorId}"`);
  return id;
}

function remapSeedSourceRef(source: SeedSource, containerIdMap: Record<string, number>): Record<string, unknown> {
  switch (source.type) {
    case "seed":
      return { seed: source.seed };
    case "bye":
      return {};
    case "qualification":
      return { qualificationId: source.qualificationId };
    case "group_rank": {
      const realContainerId = containerIdMap[source.containerId];
      if (realContainerId === undefined) {
        throw new Error(`persistGeneratedGraph: no real container mapped for group_rank source "${source.containerId}"`);
      }
      return { containerId: realContainerId, rank: source.rank };
    }
  }
}

export interface HydratedMatch {
  id: number;
  containerId: number;
  entrantAId: number | null;
  entrantBId: number | null;
  status: "pending" | "live" | "completed";
}

/**
 * Loads the minimal subgraph needed by `resolveMatch` (Phase 2's
 * orchestrator): every `bracket_edges` row leaving `matchId`, and the
 * current state of every match those edges point to. Real DB ids are
 * stringified for the pure engine functions (which only know string ids).
 */
export async function hydrateOutgoingSubgraph(
  matchId: number
): Promise<{ outgoingEdges: BracketEdge[]; downstreamMatches: MatchNode[] }> {
  const edgeRows = await db.select().from(bracketEdges).where(eq(bracketEdges.fromMatchId, matchId));
  if (edgeRows.length === 0) {
    return { outgoingEdges: [], downstreamMatches: [] };
  }

  const downstreamIds = [...new Set(edgeRows.map((e) => e.toMatchId))];
  const downstreamRows = await db.select().from(matches).where(inArray(matches.id, downstreamIds));

  return {
    outgoingEdges: edgeRows.map((e) => ({
      fromMatchId: String(e.fromMatchId),
      fromResult: e.fromResult,
      toMatchId: String(e.toMatchId),
      toSlot: e.toSlot,
    })),
    downstreamMatches: downstreamRows.map((m) => ({
      id: String(m.id),
      containerId: String(m.containerId),
      round: m.round,
      label: m.label ?? undefined,
      bestOf: m.bestOf,
      status: m.status,
      entrantAId: m.entrantAId !== null ? String(m.entrantAId) : null,
      entrantBId: m.entrantBId !== null ? String(m.entrantBId) : null,
      seeds: [],
    })),
  };
}

/**
 * Applies resolution patches (already computed by `resolveMatchInGraph`)
 * inside the given transaction. `becomesReady` (the shared pure engine's
 * generic vocabulary) is intentionally ignored — GC-Stats has no distinct
 * "ready" match status (cf. schema/bracket.ts::matchStatusEnum), mirroring
 * V1 where a match with both slots filled just stays "upcoming" until it
 * goes live.
 */
export async function applyDownstreamPatches(
  tx: Tx,
  patches: { matchId: string; slot: "a" | "b"; entrantId: string; becomesReady: boolean }[]
): Promise<void> {
  for (const patch of patches) {
    const column = patch.slot === "a" ? { entrantAId: Number(patch.entrantId) } : { entrantBId: Number(patch.entrantId) };
    await tx.update(matches).set(column).where(eq(matches.id, Number(patch.matchId)));
  }
}

/** Every match currently in a given container, for round/standings bookkeeping. */
export async function getContainerMatches(containerId: number) {
  return db.select().from(matches).where(eq(matches.containerId, containerId));
}

export async function getMatch(matchId: number) {
  const [row] = await db.select().from(matches).where(eq(matches.id, matchId));
  return row ?? null;
}

/** Every `match_seeds` row of type `group_rank` waiting for a specific
 *  standings rank out of a specific (group) container — how a completed
 *  group feeds a downstream bracket without a `bracketEdges` row (the group
 *  doesn't know who will hold rank N until it finishes). */
export async function findGroupRankSeeds(tx: Tx, containerId: number, rank: number) {
  return tx
    .select()
    .from(matchSeeds)
    .where(
      and(
        eq(matchSeeds.sourceType, "group_rank"),
        sql`(${matchSeeds.sourceRef}->>'containerId')::int = ${containerId}`,
        sql`(${matchSeeds.sourceRef}->>'rank')::int = ${rank}`
      )
    );
}

/** Every `match_seeds` row waiting on a specific `stage_qualifications` rule
 *  (the non-rank case: e.g. "loser of the 3rd place decider"). */
export async function findQualificationSeeds(tx: Tx, qualificationId: number) {
  return tx
    .select()
    .from(matchSeeds)
    .where(
      and(
        eq(matchSeeds.sourceType, "qualification"),
        sql`(${matchSeeds.sourceRef}->>'qualificationId')::int = ${qualificationId}`
      )
    );
}

/** Fills one slot of a match from a resolved seed (group rank or
 *  qualification) — the seed-driven counterpart to `applyDownstreamPatches`.
 *  A slot already holding a team is left untouched. */
export async function fillMatchSlotFromSeed(tx: Tx, matchId: number, slot: "a" | "b", entrantId: number): Promise<void> {
  const [column, value] = slot === "a" ? [matches.entrantAId, { entrantAId: entrantId }] : [matches.entrantBId, { entrantBId: entrantId }];
  await tx.update(matches).set(value).where(and(eq(matches.id, matchId), isNull(column)));
}

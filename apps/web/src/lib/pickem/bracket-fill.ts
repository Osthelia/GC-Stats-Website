/**
 * GC-Stats - bracket-fill
 *
 * Simulates a pick'em bracket forward from a set of predicted winners,
 * resolving every match's two slots (real results or predictions) so the
 * pick form and scoring logic always work off a fully resolved bracket.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { EditorMatch, EditorEdge } from "@/lib/admin-bracket-editor-data";

export type VirtualSlot = { entrantId: number | null; isReal: boolean };
export type VirtualMatch = { matchId: number; round: number; a: VirtualSlot; b: VirtualSlot };

/**
 * Reconstructs, for every match across ALL bracket containers of a stage,
 * which two entrants would face off there under a given set of predictions.
 * Real data always wins (`matches.entrantAId`/`entrantBId`, already resolved
 * by actual results); everything else falls back to the predicted OUTCOME of
 * whichever match feeds that slot (recursive), or to the user's own
 * standings pick when the slot is fed by a `group_rank` seed instead of a
 * bracket edge.
 *
 * Matches must be passed for the WHOLE stage, not one container at a time —
 * a double/triple elimination stage routes a match's loser into a different
 * container (its own "swimlane", see
 * packages/bracket-engine/src/generators/double-elimination.ts) via a
 * `bracketEdges` row exactly like it routes a winner into the next round,
 * round numbers just aren't comparable across containers. Matches are
 * therefore processed in true topological order (Kahn's algorithm over the
 * edges), not sorted by round, and `fromResult` on each edge picks which of
 * the source match's two predicted entrants feeds the slot: "winner", or
 * "loser" (the other one).
 *
 * A match with both slots resolved this way is exactly what the pick'em
 * form must ask a winner for — see `getPickableMatches`.
 */
export function computeVirtualBracket(
  bracketMatches: EditorMatch[],
  edges: EditorEdge[],
  predictedWinners: ReadonlyMap<number, number>,
  predictedGroupRank: (containerId: number, rank: number) => number | null
): Map<number, VirtualMatch> {
  const winners = new Map(predictedWinners);
  const matchById = new Map(bracketMatches.map((m) => [m.id, m]));

  const incomingByMatch = new Map<number, Partial<Record<"a" | "b", EditorEdge>>>();
  const outgoingByFromMatch = new Map<number, EditorEdge[]>();
  for (const edge of edges) {
    // Only edges wholly inside this match set matter here (a cross-stage
    // link would be a `stage_qualifications` row, not a `bracketEdges` one).
    if (!matchById.has(edge.fromMatchId) || !matchById.has(edge.toMatchId)) continue;
    const incoming = incomingByMatch.get(edge.toMatchId) ?? {};
    incoming[edge.toSlot] = edge;
    incomingByMatch.set(edge.toMatchId, incoming);
    const outgoing = outgoingByFromMatch.get(edge.fromMatchId) ?? [];
    outgoing.push(edge);
    outgoingByFromMatch.set(edge.fromMatchId, outgoing);
  }

  const order = topologicalOrder(bracketMatches, incomingByMatch, outgoingByFromMatch);
  const result = new Map<number, VirtualMatch>();

  function resolveSlot(match: EditorMatch, slot: "a" | "b", incomingEdge: EditorEdge | undefined): VirtualSlot {
    const realId = slot === "a" ? match.entrantAId : match.entrantBId;
    if (realId !== null) return { entrantId: realId, isReal: true };

    if (incomingEdge) {
      const sourceWinnerId = winners.get(incomingEdge.fromMatchId) ?? null;
      if (incomingEdge.fromResult === "winner") return { entrantId: sourceWinnerId, isReal: false };

      // "loser": whichever of the source match's two predicted entrants isn't the predicted winner.
      const sourceVirtual = result.get(incomingEdge.fromMatchId);
      if (sourceWinnerId === null || !sourceVirtual) return { entrantId: null, isReal: false };
      if (sourceVirtual.a.entrantId === sourceWinnerId) return { entrantId: sourceVirtual.b.entrantId, isReal: false };
      if (sourceVirtual.b.entrantId === sourceWinnerId) return { entrantId: sourceVirtual.a.entrantId, isReal: false };
      return { entrantId: null, isReal: false };
    }

    const seed = match.seeds.find((s) => s.slot === slot);
    if (seed?.sourceType === "group_rank") {
      const ref = seed.sourceRef as { containerId: number; rank: number };
      return { entrantId: predictedGroupRank(ref.containerId, ref.rank), isReal: false };
    }
    return { entrantId: null, isReal: false };
  }

  for (const match of order) {
    const incoming = incomingByMatch.get(match.id) ?? {};
    const a = resolveSlot(match, "a", incoming.a);
    const b = resolveSlot(match, "b", incoming.b);
    result.set(match.id, { matchId: match.id, round: match.round, a, b });

    if (winners.has(match.id)) continue;
    // A forced bye (this slot will never have a real opponent) auto-advances
    // the other side, so downstream rounds don't wait on a pick that can't exist.
    if (a.entrantId !== null && b.entrantId === null && !incoming.b && isPermanentByeSlot(match, "b")) {
      winners.set(match.id, a.entrantId);
    } else if (b.entrantId !== null && a.entrantId === null && !incoming.a && isPermanentByeSlot(match, "a")) {
      winners.set(match.id, b.entrantId);
    }
  }

  return result;
}

/**
 * Kahn's algorithm: a match is only ready once every match feeding it (by a
 * `bracketEdges` row inside this set) has already been ordered. Ties (several
 * matches ready at once) break by container then round then id, purely for
 * a stable/readable order — irrelevant to correctness.
 */
function topologicalOrder(
  matches: EditorMatch[],
  incomingByMatch: Map<number, Partial<Record<"a" | "b", EditorEdge>>>,
  outgoingByFromMatch: Map<number, EditorEdge[]>
): EditorMatch[] {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const remainingIncoming = new Map<number, number>();
  for (const m of matches) remainingIncoming.set(m.id, Object.keys(incomingByMatch.get(m.id) ?? {}).length);

  const tiebreak = (a: EditorMatch, b: EditorMatch) => a.containerId - b.containerId || a.round - b.round || a.id - b.id;
  const queue = matches.filter((m) => remainingIncoming.get(m.id) === 0).sort(tiebreak);
  const seen = new Set(queue.map((m) => m.id));
  const order: EditorMatch[] = [];

  while (queue.length > 0) {
    const match = queue.shift()!;
    order.push(match);
    for (const edge of outgoingByFromMatch.get(match.id) ?? []) {
      const remaining = (remainingIncoming.get(edge.toMatchId) ?? 0) - 1;
      remainingIncoming.set(edge.toMatchId, remaining);
      if (remaining <= 0 && !seen.has(edge.toMatchId)) {
        const next = matchById.get(edge.toMatchId);
        if (next) {
          seen.add(next.id);
          const insertAt = queue.findIndex((m) => tiebreak(m, next) > 0);
          if (insertAt === -1) queue.push(next);
          else queue.splice(insertAt, 0, next);
        }
      }
    }
  }

  // A cycle would be a malformed bracket (shouldn't happen) — append
  // whatever's left in a stable order rather than silently dropping matches.
  for (const m of [...matches].sort(tiebreak)) if (!seen.has(m.id)) order.push(m);

  return order;
}

function isPermanentByeSlot(match: EditorMatch, emptySlot: "a" | "b"): boolean {
  const seed = match.seeds.find((s) => s.slot === emptySlot);
  return !seed || seed.sourceType === "bye";
}

/** Matches where both slots are resolved (real or predicted) — exactly what needs a pick. */
export function getPickableMatches(virtual: Map<number, VirtualMatch>): VirtualMatch[] {
  return [...virtual.values()].filter((m) => m.a.entrantId !== null && m.b.entrantId !== null);
}

/**
 * Every match id reachable by following outgoing edges from `matchId`
 * (winner AND loser paths alike) — changing a pick invalidates all of
 * these, not just later rounds of the same container, since a match can
 * feed a DIFFERENT container's slot (double/triple elimination).
 */
export function getDownstreamMatchIds(matchId: number, edges: EditorEdge[]): Set<number> {
  const outgoingByFromMatch = new Map<number, number[]>();
  for (const edge of edges) {
    const list = outgoingByFromMatch.get(edge.fromMatchId) ?? [];
    list.push(edge.toMatchId);
    outgoingByFromMatch.set(edge.fromMatchId, list);
  }

  const downstream = new Set<number>();
  const queue = [...(outgoingByFromMatch.get(matchId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (downstream.has(id)) continue;
    downstream.add(id);
    for (const next of outgoingByFromMatch.get(id) ?? []) queue.push(next);
  }
  return downstream;
}

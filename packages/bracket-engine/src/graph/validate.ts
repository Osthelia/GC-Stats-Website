/**
 * GC-Stats — Bracket graph validation
 *
 * Validates a BracketGraph produced by a generator or the visual editor:
 * every slot fed exactly once, no unknown edge references, no orphan
 * slots, and the graph is a DAG (no cycles).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { BracketGraph, Slot } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Non-negotiable checks (cf. spec) on a graph produced by a generator or by
 * the visual editor:
 * - every edge references an existing match
 * - a (match, slot) pair is never fed twice (by two edges, or an edge + a seed)
 * - every slot of every match is fed by at least one source (edge or seed)
 *   — otherwise the match is orphaned and can never start
 * - the graph is a DAG (no cycle) following fromMatchId -> toMatchId edges
 */
export function validateGraph(graph: BracketGraph): ValidationResult {
  const errors: string[] = [];
  const matchIds = new Set(graph.matches.map((m) => m.id));

  const feeders = new Map<string, Set<Slot>>();
  const markFed = (matchId: string, slot: Slot) => {
    const set = feeders.get(matchId) ?? new Set<Slot>();
    set.add(slot);
    feeders.set(matchId, set);
  };

  const seenSlotEdge = new Set<string>();
  const seenSlotSeed = new Set<string>();

  for (const match of graph.matches) {
    for (const seed of match.seeds) {
      seenSlotSeed.add(`${match.id}:${seed.slot}`);
      markFed(match.id, seed.slot);
    }
  }

  for (const edge of graph.edges) {
    if (!matchIds.has(edge.fromMatchId)) {
      errors.push(`edge references unknown fromMatchId=${edge.fromMatchId}`);
    }
    if (!matchIds.has(edge.toMatchId)) {
      errors.push(`edge references unknown toMatchId=${edge.toMatchId}`);
    }
    const key = `${edge.toMatchId}:${edge.toSlot}`;
    if (seenSlotEdge.has(key)) {
      errors.push(`slot ${key} is fed by more than one edge`);
    }
    if (seenSlotSeed.has(key)) {
      errors.push(`slot ${key} is fed by both a seed and an edge`);
    }
    seenSlotEdge.add(key);
    markFed(edge.toMatchId, edge.toSlot);
  }

  for (const match of graph.matches) {
    const fed = feeders.get(match.id) ?? new Set<Slot>();
    for (const slot of ["a", "b"] as const) {
      if (!fed.has(slot)) {
        errors.push(`match ${match.id} has an unfed slot "${slot}" (orphan)`);
      }
    }
  }

  const cycleError = findCycle(graph);
  if (cycleError) errors.push(cycleError);

  return { valid: errors.length === 0, errors };
}

function findCycle(graph: BracketGraph): string | null {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.fromMatchId) ?? [];
    list.push(edge.toMatchId);
    adjacency.set(edge.fromMatchId, list);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const state = new Map<string, number>();
  for (const match of graph.matches) state.set(match.id, WHITE);

  let cycleNode: string | null = null;

  function visit(node: string): boolean {
    state.set(node, GRAY);
    for (const next of adjacency.get(node) ?? []) {
      const s = state.get(next);
      if (s === GRAY) {
        cycleNode = next;
        return true;
      }
      if (s === WHITE && visit(next)) return true;
    }
    state.set(node, BLACK);
    return false;
  }

  for (const match of graph.matches) {
    if (state.get(match.id) === WHITE) {
      if (visit(match.id)) {
        return `cycle detected involving match ${cycleNode}`;
      }
    }
  }
  return null;
}

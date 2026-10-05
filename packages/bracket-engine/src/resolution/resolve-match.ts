/**
 * GC-Stats — Match resolution
 *
 * Pure edge propagation: given a completed match and its outgoing edges,
 * computes which downstream slots get filled and which downstream matches
 * become ready. No DB access; the app-level orchestrator persists patches.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { BracketEdge, MatchNode, Slot } from "../graph/types";

export interface ResolveMatchInput {
  /** The match just completed. */
  matchId: string;
  winnerId: string;
  loserId: string;
  /** Every `bracketEdges` row where `fromMatchId === matchId`. */
  outgoingEdges: BracketEdge[];
  /** The current state of every match those edges point to (deduped by id). */
  downstreamMatches: MatchNode[];
}

export interface DownstreamPatch {
  matchId: string;
  slot: Slot;
  entrantId: string;
  /** Whether this patch fills the LAST empty slot, flipping the match to "ready". */
  becomesReady: boolean;
}

export interface ResolveMatchResult {
  patches: DownstreamPatch[];
}

/**
 * Pure edge-propagation core of the match resolution service: given a
 * completed match's outgoing edges and the current state of the matches
 * they feed, computes which downstream slots get filled and which
 * downstream matches transition from "pending" to "ready" (both slots now
 * filled). No DB access, no swiss-round-triggering, no standings — those
 * need broader context (other containers, full history) and live in the
 * app-level orchestrator (`apps/web/src/lib/bracket/match-resolution-service.ts`,
 * Phase 2) which calls this function once per resolved match and persists
 * the resulting patches.
 */
export function resolveMatchInGraph(input: ResolveMatchInput): ResolveMatchResult {
  const { matchId, winnerId, loserId, outgoingEdges, downstreamMatches } = input;
  const byId = new Map(downstreamMatches.map((m) => [m.id, m]));
  const patches: DownstreamPatch[] = [];

  // Track slots filled by earlier patches in this same pass, so that if two
  // edges from THIS match feed the same downstream match (shouldn't happen
  // structurally, but stay correct regardless), "becomesReady" reflects the
  // cumulative state.
  const pendingFill = new Map<string, { a?: string; b?: string }>();

  for (const edge of outgoingEdges) {
    if (edge.fromMatchId !== matchId) continue;
    const entrantId = edge.fromResult === "winner" ? winnerId : loserId;
    const target = byId.get(edge.toMatchId);
    if (!target) continue;

    const already = pendingFill.get(target.id) ?? {
      a: target.entrantAId ?? undefined,
      b: target.entrantBId ?? undefined,
    };
    // A slot already holding a team (set by hand or an earlier resolution) is never overwritten.
    if (already[edge.toSlot] !== undefined) continue;
    already[edge.toSlot] = entrantId;
    pendingFill.set(target.id, already);

    const becomesReady = already.a !== undefined && already.b !== undefined && target.status === "pending";
    patches.push({ matchId: target.id, slot: edge.toSlot, entrantId, becomesReady });
  }

  return { patches };
}

/**
 * GC-Stats — Bracket graph types
 *
 * Pure types with no dependency on Drizzle or any DB. Ids are strings
 * (temporary from the generator); the repository layer maps them to real DB
 * ids on persistence.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type ContainerType = "bracket" | "group";
export type MatchStatus = "pending" | "ready" | "live" | "completed";
export type Slot = "a" | "b";
export type MatchResult = "winner" | "loser";

export type SeedSource =
  | { type: "seed"; seed: number }
  | { type: "group_rank"; containerId: string; rank: number }
  | { type: "bye" }
  | { type: "qualification"; qualificationId: string };

export interface MatchSeedDTO {
  slot: Slot;
  source: SeedSource;
}

export interface MatchNode {
  id: string;
  containerId: string;
  round: number;
  label?: string;
  bestOf: number;
  status: MatchStatus;
  entrantAId?: string | null;
  entrantBId?: string | null;
  /** Starting sources for slots not fed by an edge (fixed seed, bye, group rank). */
  seeds: MatchSeedDTO[];
}

export interface BracketEdge {
  fromMatchId: string;
  fromResult: MatchResult;
  toMatchId: string;
  toSlot: Slot;
}

export interface BracketGraph {
  matches: MatchNode[];
  edges: BracketEdge[];
}

/** A match is a "bye" when only one of its two slots has a real source. */
export function isByeMatch(match: MatchNode): boolean {
  const a = match.seeds.find((s) => s.slot === "a");
  const b = match.seeds.find((s) => s.slot === "b");
  const aIsBye = !a || a.source.type === "bye";
  const bIsBye = !b || b.source.type === "bye";
  return aIsBye !== bIsBye; // exactly one of the two is a bye
}

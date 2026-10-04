/**
 * GC-Stats - group-progression
 *
 * Wins/losses bookkeeping and round advancement shared by every group
 * format (swiss, round robin) in the bracket resolution service.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { entrants, groupEntries, matches } from "@gc-stats/db";
import { pairRound, recomputeBuchholz, type SwissEntrant, type SwissHistoryEntry } from "@gc-stats/bracket-engine";
import type { Tx } from "./repository";
import type { SwissGroupConfig } from "./config-types";

export interface ResolvedGroupMatch {
  containerId: number;
  round: number;
  winnerEntrantId: number;
  loserEntrantId: number;
}

async function getGroupEntries(tx: Tx, containerId: number) {
  return tx.select().from(groupEntries).where(eq(groupEntries.containerId, containerId));
}

/** Wins/losses bookkeeping shared by every group format (swiss, round robin). */
export async function bumpRecordAfterMatch(tx: Tx, m: ResolvedGroupMatch): Promise<void> {
  const [winnerEntry] = await tx
    .select()
    .from(groupEntries)
    .where(and(eq(groupEntries.containerId, m.containerId), eq(groupEntries.entrantId, m.winnerEntrantId)));
  const [loserEntry] = await tx
    .select()
    .from(groupEntries)
    .where(and(eq(groupEntries.containerId, m.containerId), eq(groupEntries.entrantId, m.loserEntrantId)));
  if (winnerEntry) {
    await tx.update(groupEntries).set({ wins: winnerEntry.wins + 1 }).where(eq(groupEntries.id, winnerEntry.id));
  }
  if (loserEntry) {
    await tx.update(groupEntries).set({ losses: loserEntry.losses + 1 }).where(eq(groupEntries.id, loserEntry.id));
  }
}

async function applyStatusThresholds(tx: Tx, containerId: number, config: SwissGroupConfig): Promise<void> {
  const entries = await getGroupEntries(tx, containerId);
  for (const entry of entries) {
    if (entry.status !== "active") continue;
    if (config.qualifyAtWins !== null && entry.wins >= config.qualifyAtWins) {
      await tx.update(groupEntries).set({ status: "qualified" }).where(eq(groupEntries.id, entry.id));
    } else if (config.eliminateAtLosses !== null && entry.losses >= config.eliminateAtLosses) {
      await tx.update(groupEntries).set({ status: "eliminated" }).where(eq(groupEntries.id, entry.id));
    }
  }
}

async function buildSwissHistory(tx: Tx, containerId: number): Promise<SwissHistoryEntry[]> {
  const rows = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.containerId, containerId), eq(matches.status, "completed")));
  return rows
    .filter((r) => r.entrantAId !== null && r.entrantBId !== null)
    .map((r) => ({ round: r.round, aId: String(r.entrantAId), bId: String(r.entrantBId) }));
}

async function recomputeAndStoreBuchholz(tx: Tx, containerId: number): Promise<void> {
  const entries = await getGroupEntries(tx, containerId);
  const history = await buildSwissHistory(tx, containerId);
  const dtos: SwissEntrant[] = entries.map((e) => ({
    id: String(e.entrantId),
    seed: e.seed ?? 0,
    wins: e.wins,
    losses: e.losses,
    buchholz: e.buchholz,
    roundDiff: e.roundDiff,
    hadBye: e.hadBye,
    status: e.status,
  }));
  const recomputed = recomputeBuchholz(dtos, history);
  for (const r of recomputed) {
    const entry = entries.find((e) => String(e.entrantId) === r.id)!;
    if (entry.buchholz !== r.buchholz) {
      await tx.update(groupEntries).set({ buchholz: r.buchholz }).where(eq(groupEntries.id, entry.id));
    }
  }
}

async function isRoundComplete(tx: Tx, containerId: number, round: number): Promise<boolean> {
  const rows = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.containerId, containerId), eq(matches.round, round)));
  return rows.every((r) => r.status === "completed");
}

/**
 * Generates and persists the next Swiss round directly (no `bracketEdges`/
 * `matchSeeds` — Swiss pairing is dynamic, per spec). A bye pairing doesn't
 * create a match row at all: it's an immediate win, applied straight to
 * `group_entries` (wins+1, hadBye=true) since there's no opponent to
 * resolve a match against.
 */
async function generateAndInsertNextSwissRound(tx: Tx, containerId: number, config: SwissGroupConfig, currentRound: number): Promise<void> {
  const entries = (await getGroupEntries(tx, containerId)).filter((e) => e.status === "active");
  const history = await buildSwissHistory(tx, containerId);
  const dtos: SwissEntrant[] = entries.map((e) => ({
    id: String(e.entrantId),
    seed: e.seed ?? 0,
    wins: e.wins,
    losses: e.losses,
    buchholz: e.buchholz,
    roundDiff: e.roundDiff,
    hadBye: e.hadBye,
    status: e.status,
  }));

  const result = pairRound({
    round: currentRound + 1,
    entrants: dtos,
    history,
    config: {
      qualifyAtWins: config.qualifyAtWins,
      eliminateAtLosses: config.eliminateAtLosses,
      maxRounds: config.maxRounds,
      roundFormat: config.roundFormat,
      tiebreakers: config.tiebreakers,
    },
  });

  for (const pairing of result.pairings) {
    if (pairing.bId === null) {
      const entry = entries.find((e) => String(e.entrantId) === pairing.aId)!;
      await tx.update(groupEntries).set({ wins: entry.wins + 1, hadBye: true }).where(eq(groupEntries.id, entry.id));
      continue;
    }
    await tx.insert(matches).values({
      containerId,
      round: result.round,
      bestOf: result.bestOf,
      status: "pending",
      entrantAId: Number(pairing.aId),
      entrantBId: Number(pairing.bId),
    });
  }
}

export interface SwissAdvanceResult {
  /** Whether the group is fully decided (no more rounds to generate). */
  completed: boolean;
}

/**
 * Called after a Swiss group's match is committed as completed: updates the
 * record, recomputes Buchholz, checks qualify/eliminate thresholds, and —
 * once every match of the just-finished round is completed — either
 * generates the next round or reports the group is done (all active
 * entrants resolved, or `maxRounds` reached).
 */
export async function advanceSwissGroup(tx: Tx, config: SwissGroupConfig, m: ResolvedGroupMatch): Promise<SwissAdvanceResult> {
  await bumpRecordAfterMatch(tx, m);
  await recomputeAndStoreBuchholz(tx, m.containerId);
  await applyStatusThresholds(tx, m.containerId, config);

  if (!(await isRoundComplete(tx, m.containerId, m.round))) {
    return { completed: false };
  }

  const active = (await getGroupEntries(tx, m.containerId)).filter((e) => e.status === "active");
  if (active.length === 0 || m.round >= config.maxRounds) {
    return { completed: true };
  }

  await generateAndInsertNextSwissRound(tx, m.containerId, config, m.round);
  return { completed: false };
}

/** Round robin has no dynamic pairing — every match is already on the
 *  board (generated up-front). Just bookkeeping; completion is detected
 *  generically (every match row in the container is completed). */
export async function advanceRoundRobinGroup(tx: Tx, m: ResolvedGroupMatch): Promise<void> {
  await bumpRecordAfterMatch(tx, m);
}

/**
 * Rebuilds a group's `group_entries` from the matches already in it —
 * used when an existing container is converted to a group (typically a
 * historically-migrated container that landed as a bracket). Same
 * derivation as the migrate-v1 group_entries backfill: entrants come from
 * match participation, wins/losses from completed matches, Buchholz
 * recomputed via the engine. Any previous entries are replaced.
 */
export async function rebuildGroupEntriesFromMatches(tx: Tx, containerId: number): Promise<void> {
  await tx.delete(groupEntries).where(eq(groupEntries.containerId, containerId));

  const containerMatches = await tx
    .select({ entrantAId: matches.entrantAId, entrantBId: matches.entrantBId, winnerId: matches.winnerId, status: matches.status })
    .from(matches)
    .where(eq(matches.containerId, containerId));

  const record = new Map<number, { wins: number; losses: number }>();
  for (const m of containerMatches) {
    for (const id of [m.entrantAId, m.entrantBId]) {
      if (id !== null && !record.has(id)) record.set(id, { wins: 0, losses: 0 });
    }
    if (m.status !== "completed" || m.winnerId === null || m.entrantAId === null || m.entrantBId === null) continue;
    const loserId = m.winnerId === m.entrantAId ? m.entrantBId : m.entrantAId;
    record.get(m.winnerId)!.wins++;
    record.get(loserId)!.losses++;
  }
  if (record.size === 0) return;

  const seedRows = await tx.select({ id: entrants.id, seed: entrants.seed }).from(entrants).where(inArray(entrants.id, [...record.keys()]));
  const seedById = new Map(seedRows.map((r) => [r.id, r.seed]));

  await tx.insert(groupEntries).values([...record].map(([entrantId, r]) => ({ containerId, entrantId, seed: seedById.get(entrantId) ?? null, wins: r.wins, losses: r.losses })));
  await recomputeAndStoreBuchholz(tx, containerId);
}

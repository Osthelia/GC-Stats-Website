/**
 * GC-Stats - group-progression
 *
 * Wins/losses bookkeeping and round advancement shared by every group
 * format (swiss, round robin) in the bracket resolution service.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { gameTables } from "@gc-stats/db";
import { recomputeBuchholz, type SwissEntrant, type SwissHistoryEntry } from "@osthelia/bracket-engine";
import type { Tx } from "./repository";
import type { SwissGroupConfig } from "./config-types";
import type { GameSlug } from "@gc-stats/db/game";

export interface ResolvedGroupMatch {
  containerId: number;
  round: number;
  winnerEntrantId: number;
  loserEntrantId: number;
}

async function getGroupEntries(game: GameSlug, tx: Tx, containerId: number) {
  const { groupEntries } = gameTables(game);
  return tx.select().from(groupEntries).where(eq(groupEntries.containerId, containerId));
}

/** Wins/losses bookkeeping shared by every group format (swiss, round robin). */
export async function bumpRecordAfterMatch(game: GameSlug, tx: Tx, m: ResolvedGroupMatch): Promise<void> {
  const { groupEntries } = gameTables(game);
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

async function applyStatusThresholds(game: GameSlug, tx: Tx, containerId: number, config: SwissGroupConfig): Promise<void> {
  const { groupEntries } = gameTables(game);
  const entries = await getGroupEntries(game, tx, containerId);
  for (const entry of entries) {
    if (entry.status !== "active") continue;
    if (config.qualifyAtWins !== null && entry.wins >= config.qualifyAtWins) {
      await tx.update(groupEntries).set({ status: "qualified" }).where(eq(groupEntries.id, entry.id));
    } else if (config.eliminateAtLosses !== null && entry.losses >= config.eliminateAtLosses) {
      await tx.update(groupEntries).set({ status: "eliminated" }).where(eq(groupEntries.id, entry.id));
    }
  }
}

async function buildSwissHistory(game: GameSlug, tx: Tx, containerId: number): Promise<SwissHistoryEntry[]> {
  const { matches } = gameTables(game);
  const rows = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.containerId, containerId), eq(matches.status, "completed")));
  return rows
    .filter((r) => r.entrantAId !== null && r.entrantBId !== null)
    .map((r) => ({ round: r.round, aId: String(r.entrantAId), bId: String(r.entrantBId) }));
}

async function recomputeAndStoreBuchholz(game: GameSlug, tx: Tx, containerId: number): Promise<void> {
  const { groupEntries } = gameTables(game);
  const entries = await getGroupEntries(game, tx, containerId);
  const history = await buildSwissHistory(game, tx, containerId);
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

async function isRoundComplete(game: GameSlug, tx: Tx, containerId: number, round: number): Promise<boolean> {
  const { matches } = gameTables(game);
  const rows = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.containerId, containerId), eq(matches.round, round)));
  return rows.every((r) => r.status === "completed");
}

export interface SwissAdvanceResult {
  /** Whether the group is fully decided (no active entrant left, or `maxRounds` reached). */
  completed: boolean;
}

/**
 * Called after a Swiss group's match is committed as completed: updates the
 * record, recomputes Buchholz, checks qualify/eliminate thresholds, and
 * reports whether the group is done once its current round is finished.
 */
export async function advanceSwissGroup(game: GameSlug, tx: Tx, config: SwissGroupConfig, m: ResolvedGroupMatch): Promise<SwissAdvanceResult> {
  await bumpRecordAfterMatch(game, tx, m);
  await recomputeAndStoreBuchholz(game, tx, m.containerId);
  await applyStatusThresholds(game, tx, m.containerId, config);

  if (!(await isRoundComplete(game, tx, m.containerId, m.round))) {
    return { completed: false };
  }

  const active = (await getGroupEntries(game, tx, m.containerId)).filter((e) => e.status === "active");
  if (active.length === 0 || m.round >= config.maxRounds) {
    return { completed: true };
  }

  // Rounds are never generated automatically, admins create them (bulk create).
  return { completed: false };
}

/** Round robin has no dynamic pairing — every match is already on the
 *  board (generated up-front). Just bookkeeping; completion is detected
 *  generically (every match row in the container is completed). */
export async function advanceRoundRobinGroup(game: GameSlug, tx: Tx, m: ResolvedGroupMatch): Promise<void> {
  await bumpRecordAfterMatch(game, tx, m);
}

/** Wins/losses per entrant from the completed matches of the given containers (every entrant with a match is listed). */
export async function recordsFromMatches(game: GameSlug, tx: Tx, containerIds: number[]): Promise<Map<number, { wins: number; losses: number }>> {
  const { matches } = gameTables(game);
  const containerMatches = await tx
    .select({ entrantAId: matches.entrantAId, entrantBId: matches.entrantBId, winnerId: matches.winnerId, status: matches.status })
    .from(matches)
    .where(inArray(matches.containerId, containerIds));

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
  return record;
}

/**
 * Rebuilds a group's `group_entries` from the matches already in it —
 * used when an existing container is converted to a group (typically a
 * historically-migrated container that landed as a bracket). Same
 * derivation as the migrate-v1 group_entries backfill: entrants come from
 * match participation, wins/losses from completed matches, Buchholz
 * recomputed via the engine. Any previous entries are replaced.
 */
export async function rebuildGroupEntriesFromMatches(game: GameSlug, tx: Tx, containerId: number): Promise<void> {
  const { entrants, groupEntries } = gameTables(game);
  await tx.delete(groupEntries).where(eq(groupEntries.containerId, containerId));

  const record = await recordsFromMatches(game, tx, [containerId]);
  if (record.size === 0) return;

  const seedRows = await tx.select({ id: entrants.id, seed: entrants.seed }).from(entrants).where(inArray(entrants.id, [...record.keys()]));
  const seedById = new Map(seedRows.map((r) => [r.id, r.seed]));

  await tx.insert(groupEntries).values([...record].map(([entrantId, r]) => ({ containerId, entrantId, seed: seedById.get(entrantId) ?? null, wins: r.wins, losses: r.losses })));
  await recomputeAndStoreBuchholz(game, tx, containerId);
}

/**
 * Realigns existing `group_entries` wins/losses on the container's completed
 * matches (a bye counts as one win), then recomputes Buchholz. Used after
 * results are written outside the resolution flow (score backfill).
 */
export async function syncGroupRecordsFromMatches(game: GameSlug, tx: Tx, containerId: number): Promise<void> {
  const { groupEntries } = gameTables(game);
  const entries = await getGroupEntries(game, tx, containerId);
  if (entries.length === 0) return;
  const record = await recordsFromMatches(game, tx, [containerId]);
  for (const entry of entries) {
    const r = record.get(entry.entrantId) ?? { wins: 0, losses: 0 };
    const wins = r.wins + (entry.hadBye ? 1 : 0);
    if (entry.wins !== wins || entry.losses !== r.losses) {
      await tx.update(groupEntries).set({ wins, losses: r.losses }).where(eq(groupEntries.id, entry.id));
    }
  }
  await recomputeAndStoreBuchholz(game, tx, containerId);
}

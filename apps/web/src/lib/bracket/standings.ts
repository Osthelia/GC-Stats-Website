/**
 * GC-Stats - standings
 *
 * Computes ranked group standings (swiss, round robin) with game/round
 * records read at request time from the series maps, not trusted from `group_entries`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { gameTables } from "@gc-stats/db";
import { createSwissStandings, createRoundRobinStandings, type RankedStandingsEntry, type StandingsEntry } from "@gc-stats/bracket-engine";
import { listMatchMapResults, type Tx } from "./repository";
import { countsForStageScope, parseGroupConfig, type GroupContainerConfig } from "./config-types";
import { computeContainerPoints } from "./points";
import { recordsFromMatches } from "./group-progression";
import type { GameSlug } from "@gc-stats/db/game";

export type GroupStandingsEntry = RankedStandingsEntry & { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };

type MapRecord = { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };

/**
 * Per-entrant map record (win/loss) and round win/loss totals, computed
 * read-time from the series maps (same `matches.entrantAId`/`entrantBId` <->
 * `teamAScore`/`teamBScore` of a Valorant map, as in `points.ts`) rather than
 * trusted from `group_entries` — that column is match-level bookkeeping
 * only (never updated with map/round data, cf. group-progression.ts) and,
 * for historically-migrated containers, was reconstructed at 0 anyway
 * (SUIVI.md, 2026-09-12 group_entries backfill). Round totals exclude
 * forfeited maps (mirrors V1's `TournamentStandings::compute`, which never
 * sees a forfeit's non-real score to begin with) — a `-1` isn't a real
 * round count and would otherwise skew the differential.
 */
async function computeMapRecord(game: GameSlug, tx: Tx, containerIds: number[]): Promise<Map<number, MapRecord>> {
  const { matches } = gameTables(game);
  const stats = new Map<number, MapRecord>();
  const bump = (entrantId: number | null, delta: Partial<MapRecord>) => {
    if (entrantId === null) return;
    const cur = stats.get(entrantId) ?? { mapWins: 0, mapLosses: 0, roundWins: 0, roundLosses: 0 };
    stats.set(entrantId, {
      mapWins: cur.mapWins + (delta.mapWins ?? 0),
      mapLosses: cur.mapLosses + (delta.mapLosses ?? 0),
      roundWins: cur.roundWins + (delta.roundWins ?? 0),
      roundLosses: cur.roundLosses + (delta.roundLosses ?? 0),
    });
  };

  const containerMatches = await tx.select().from(matches).where(inArray(matches.containerId, containerIds));
  if (containerMatches.length === 0) return stats;
  const matchById = new Map(containerMatches.map((m) => [m.id, m]));

  const mapResults = await listMatchMapResults(game, tx, containerMatches.map((m) => m.id));
  for (const map of mapResults) {
    const match = matchById.get(map.matchId);
    if (!match) continue;
    if (map.winner === "a") {
      bump(match.entrantAId, { mapWins: 1 });
      bump(match.entrantBId, { mapLosses: 1 });
    } else if (map.winner === "b") {
      bump(match.entrantBId, { mapWins: 1 });
      bump(match.entrantAId, { mapLosses: 1 });
    }
    // Rounds only exist for Valorant maps, and a forfeit's score is not a real round count.
    if (map.isCompleted && !map.isForfeit && map.roundsA !== null && map.roundsB !== null) {
      bump(match.entrantAId, { roundWins: map.roundsA, roundLosses: map.roundsB });
      bump(match.entrantBId, { roundWins: map.roundsB, roundLosses: map.roundsA });
    }
  }
  return stats;
}

type StageContainerRef = { id: number; containerType: string; config: unknown };

/** Which containers a group's matches are read from, and whether its table is limited to the pinned teams.
 *  `stageContainers` (every container of the group's stage) saves the lookup for callers that already hold them. */
async function resolveMatchScope(game: GameSlug, tx: Tx, containerId: number, config: GroupContainerConfig, stageContainers?: StageContainerRef[]): Promise<{ containerIds: number[]; pinnedOnly: boolean }> {
  if (config.matchScope === "container") return { containerIds: [containerId], pinnedOnly: false };
  let siblings = stageContainers;
  if (!siblings) {
    const { stageContainers: containersTable } = gameTables(game);
    const sibling = alias(containersTable, "sibling");
    // One round trip: the group's stage and every container in it.
    siblings = await tx
      .select({ id: sibling.id, containerType: sibling.containerType, config: sibling.config })
      .from(containersTable)
      .innerJoin(sibling, eq(sibling.stageId, containersTable.stageId))
      .where(eq(containersTable.id, containerId));
  }
  return { containerIds: siblings.filter(countsForStageScope).map((c) => c.id), pinnedOnly: true };
}

/** Ranked standings for a group container, using the calculator that
 *  matches its configured format (swiss vs round robin). Wins/losses are
 *  derived from the matches, and an entrant playing in the group without a
 *  `group_entries` row is still listed. Pass the stage's containers when
 *  the caller already has them, a stage-scoped group then needs no lookup. */
export async function computeContainerStandings(game: GameSlug, tx: Tx, containerId: number, rawConfig: unknown, stageContainers?: StageContainerRef[]): Promise<GroupStandingsEntry[]> {
  const { groupEntries, matches } = gameTables(game);
  const config = parseGroupConfig(rawConfig);
  const { containerIds, pinnedOnly } = await resolveMatchScope(game, tx, containerId, config, stageContainers);
  const [storedEntries, matchRecord, points, mapRecord, completedMatches] = await Promise.all([
    tx.select().from(groupEntries).where(eq(groupEntries.containerId, containerId)),
    recordsFromMatches(game, tx, containerIds),
    config.pointsConfig ? computeContainerPoints(game, tx, containerIds, config.pointsConfig) : null,
    computeMapRecord(game, tx, containerIds),
    // Head to head input, only read by round robin.
    config.type === "swiss"
      ? []
      : tx
          .select()
          .from(matches)
          .where(and(inArray(matches.containerId, containerIds), eq(matches.status, "completed"))),
  ]);
  const storedById = new Map(storedEntries.map((e) => [e.entrantId, e]));
  // Cross-group play: the table is its pinned teams only, whoever else played the counted matches.
  const entrantIds = pinnedOnly ? [...storedById.keys()] : [...new Set([...storedById.keys(), ...matchRecord.keys()])];
  const entries = entrantIds.map((entrantId) => {
    const stored = storedById.get(entrantId);
    const r = matchRecord.get(entrantId) ?? { wins: 0, losses: 0 };
    return {
      entrantId,
      seed: stored?.seed ?? null,
      wins: r.wins + (stored?.hadBye ? 1 : 0),
      losses: r.losses,
      buchholz: stored?.buchholz ?? 0,
    };
  });

  const emptyRecord: MapRecord = { mapWins: 0, mapLosses: 0, roundWins: 0, roundLosses: 0 };
  const gameDiffOf = (entrantId: number) => {
    const rec = mapRecord.get(entrantId) ?? emptyRecord;
    return rec.mapWins - rec.mapLosses;
  };
  const roundDiffOf = (entrantId: number) => {
    const rec = mapRecord.get(entrantId) ?? emptyRecord;
    return rec.roundWins - rec.roundLosses;
  };
  const withMapRecord = (ranked: RankedStandingsEntry[]): GroupStandingsEntry[] =>
    ranked.map((r) => {
      const rec = mapRecord.get(Number(r.id)) ?? emptyRecord;
      return { ...r, mapWins: rec.mapWins, mapLosses: rec.mapLosses, roundWins: rec.roundWins, roundLosses: rec.roundLosses };
    });

  if (config.type === "swiss") {
    const dtos: StandingsEntry[] = entries.map((e) => ({
      id: String(e.entrantId),
      seed: e.seed ?? 0,
      wins: e.wins,
      losses: e.losses,
      buchholz: e.buchholz,
      roundDiff: roundDiffOf(e.entrantId),
      points: points?.get(e.entrantId) ?? 0,
    }));
    return withMapRecord(createSwissStandings({ tiebreakers: config.tiebreakers }).recompute(dtos));
  }

  // round_robin: build head-to-head from the completed matches in scope.
  const dtos: StandingsEntry[] = entries.map((e) => {
    // Cross-group play lets a pair meet more than once, so tally per opponent instead of keeping the last result.
    const tally = new Map<string, number>();
    for (const m of completedMatches) {
      const opponentId = m.entrantAId === e.entrantId ? m.entrantBId : m.entrantBId === e.entrantId ? m.entrantAId : null;
      if (opponentId === null) continue;
      tally.set(String(opponentId), (tally.get(String(opponentId)) ?? 0) + (m.winnerId === e.entrantId ? 1 : -1));
    }
    // An even split has no head-to-head winner, so it is left out and the next tiebreaker decides.
    const headToHead = new Map<string, "win" | "loss">();
    for (const [opponentId, net] of tally) {
      if (net !== 0) headToHead.set(opponentId, net > 0 ? "win" : "loss");
    }
    return {
      id: String(e.entrantId),
      seed: e.seed ?? 0,
      wins: e.wins,
      losses: e.losses,
      buchholz: e.buchholz,
      roundDiff: roundDiffOf(e.entrantId),
      gameDiff: gameDiffOf(e.entrantId),
      headToHead,
      points: points?.get(e.entrantId) ?? 0,
    };
  });
  return withMapRecord(createRoundRobinStandings({ tiebreakers: config.tiebreakers }).recompute(dtos));
}

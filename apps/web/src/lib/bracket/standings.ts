/**
 * GC-Stats - standings
 *
 * Computes ranked group standings (swiss, round robin) with game/round
 * records read at request time from the series maps, not trusted from `group_entries`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { gameTables } from "@gc-stats/db";
import { createSwissStandings, createRoundRobinStandings, type HeadToHeadRecord, type RankedStandingsEntry, type StandingsEntry } from "@osthelia/bracket-engine";
import { listMatchMapResults, type MatchMapResult, type Tx } from "./repository";
import { countsForStageScope, parseGroupConfig, type GroupContainerConfig } from "./config-types";
import { computeContainerPoints } from "./points";
import { recordsFromMatches } from "./group-progression";
import type { GameSlug } from "@gc-stats/db/game";

export type GroupStandingsEntry = RankedStandingsEntry & { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };

type MapRecord = { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };
export type StandingsMatch = { id: number; entrantAId: number | null; entrantBId: number | null; winnerId: number | null; status: string };
export type StandingsMap = Pick<MatchMapResult, "matchId" | "winner" | "isCompleted" | "isForfeit" | "roundsA" | "roundsB">;

const emptyMapRecord = (): MapRecord => ({ mapWins: 0, mapLosses: 0, roundWins: 0, roundLosses: 0 });

/** One map (or game) seen from each side, null when it has no result. A forfeited map counts as a map,
 *  but its score is not a round count. Only Valorant maps have rounds. */
function mapResult(map: StandingsMap): { a: MapRecord; b: MapRecord } | null {
  if (!map.isCompleted) return null;
  const aWon = map.winner === "a" ? 1 : 0;
  const bWon = map.winner === "b" ? 1 : 0;
  const hasRounds = !map.isForfeit && map.roundsA !== null && map.roundsB !== null;
  const roundsA = hasRounds ? map.roundsA! : 0;
  const roundsB = hasRounds ? map.roundsB! : 0;
  return {
    a: { mapWins: aWon, mapLosses: bWon, roundWins: roundsA, roundLosses: roundsB },
    b: { mapWins: bWon, mapLosses: aWon, roundWins: roundsB, roundLosses: roundsA },
  };
}

/**
 * Map and round totals per entrant, plus the head to head record of every pair over their
 * completed matches. Read at request time from the series maps, `group_entries` only
 * keeps match level counters.
 */
export function groupRecords(containerMatches: StandingsMatch[], containerMaps: StandingsMap[]) {
  const totals = new Map<number, MapRecord>();
  const meetings = new Map<number, Map<string, HeadToHeadRecord>>();

  const addTotals = (entrantId: number | null, delta: MapRecord) => {
    if (entrantId === null) return;
    const cur = totals.get(entrantId) ?? emptyMapRecord();
    totals.set(entrantId, {
      mapWins: cur.mapWins + delta.mapWins,
      mapLosses: cur.mapLosses + delta.mapLosses,
      roundWins: cur.roundWins + delta.roundWins,
      roundLosses: cur.roundLosses + delta.roundLosses,
    });
  };
  const addMeeting = (entrantId: number, opponentId: number, delta: Partial<HeadToHeadRecord>) => {
    const own = meetings.get(entrantId) ?? new Map<string, HeadToHeadRecord>();
    const cur = own.get(String(opponentId)) ?? { wins: 0, losses: 0, mapDiff: 0, roundDiff: 0 };
    own.set(String(opponentId), {
      wins: cur.wins + (delta.wins ?? 0),
      losses: cur.losses + (delta.losses ?? 0),
      mapDiff: cur.mapDiff + (delta.mapDiff ?? 0),
      roundDiff: cur.roundDiff + (delta.roundDiff ?? 0),
    });
    meetings.set(entrantId, own);
  };

  const matchById = new Map(containerMatches.map((m) => [m.id, m]));
  for (const m of containerMatches) {
    if (m.status !== "completed" || m.winnerId === null || m.entrantAId === null || m.entrantBId === null) continue;
    const loserId = m.winnerId === m.entrantAId ? m.entrantBId : m.entrantAId;
    addMeeting(m.winnerId, loserId, { wins: 1 });
    addMeeting(loserId, m.winnerId, { losses: 1 });
  }

  for (const map of containerMaps) {
    const match = matchById.get(map.matchId);
    const result = mapResult(map);
    if (!match || !result) continue;
    addTotals(match.entrantAId, result.a);
    addTotals(match.entrantBId, result.b);
    if (match.status !== "completed" || match.entrantAId === null || match.entrantBId === null) continue;
    const diff = (r: MapRecord) => ({ mapDiff: r.mapWins - r.mapLosses, roundDiff: r.roundWins - r.roundLosses });
    addMeeting(match.entrantAId, match.entrantBId, diff(result.a));
    addMeeting(match.entrantBId, match.entrantAId, diff(result.b));
  }

  return { totals, meetings };
}

async function loadGroupRecords(game: GameSlug, tx: Tx, containerIds: number[]) {
  const { matches } = gameTables(game);
  const containerMatches = await tx.select().from(matches).where(inArray(matches.containerId, containerIds));
  return groupRecords(containerMatches, await listMatchMapResults(game, tx, containerMatches.map((m) => m.id)));
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
  const { groupEntries } = gameTables(game);
  const config = parseGroupConfig(rawConfig);
  const { containerIds, pinnedOnly } = await resolveMatchScope(game, tx, containerId, config, stageContainers);
  const [storedEntries, matchRecord, points, records] = await Promise.all([
    tx.select().from(groupEntries).where(eq(groupEntries.containerId, containerId)),
    recordsFromMatches(game, tx, containerIds),
    config.pointsConfig ? computeContainerPoints(game, tx, containerIds, config.pointsConfig) : null,
    loadGroupRecords(game, tx, containerIds),
  ]);
  const storedById = new Map(storedEntries.map((e) => [e.entrantId, e]));
  // Cross-group play: the table is its pinned teams only, whoever else played the counted matches.
  const entrantIds = pinnedOnly ? [...storedById.keys()] : [...new Set([...storedById.keys(), ...matchRecord.keys()])];

  const dtos: StandingsEntry[] = entrantIds.map((entrantId) => {
    const stored = storedById.get(entrantId);
    const record = matchRecord.get(entrantId) ?? { wins: 0, losses: 0 };
    const maps = records.totals.get(entrantId) ?? emptyMapRecord();
    return {
      id: String(entrantId),
      seed: stored?.seed ?? 0,
      wins: record.wins + (stored?.hadBye ? 1 : 0),
      losses: record.losses,
      buchholz: stored?.buchholz ?? 0,
      roundDiff: maps.roundWins - maps.roundLosses,
      mapDiff: maps.mapWins - maps.mapLosses,
      meetings: records.meetings.get(entrantId),
      points: points?.get(entrantId) ?? 0,
    };
  });
  const withMapRecord = (ranked: RankedStandingsEntry[]): GroupStandingsEntry[] =>
    ranked.map((r) => ({ ...r, ...(records.totals.get(Number(r.id)) ?? emptyMapRecord()) }));

  const calculator =
    config.type === "swiss" ? createSwissStandings({ tiebreakers: config.tiebreakers }) : createRoundRobinStandings({ tiebreakers: config.tiebreakers });
  const ranked = calculator.recompute(dtos);
  // Points, when enabled, come before the match record and the tiebreakers.
  if (points) ranked.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  // One rank per entrant, those the chain leaves level are listed in seed order.
  return withMapRecord(ranked.map((r, i) => ({ ...r, rank: i + 1 })));
}

/**
 * GC-Stats - standings
 *
 * Computes ranked group standings (swiss, round robin) with map/round
 * records read at request time from `maps`, not trusted from `group_entries`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { groupEntries, matches, maps as mapRows } from "@gc-stats/db";
import { createSwissStandings, createRoundRobinStandings, type HeadToHeadRecord, type RankedStandingsEntry, type StandingsEntry } from "@osthelia/bracket-engine";
import type { Tx } from "./repository";
import { parseGroupConfig } from "./config-types";
import { computeContainerPoints } from "./points";
import { recordsFromMatches } from "./group-progression";

export type GroupStandingsEntry = RankedStandingsEntry & { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };

type MapRecord = { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };
export type StandingsMatch = Pick<typeof matches.$inferSelect, "id" | "entrantAId" | "entrantBId" | "winnerId" | "status">;
export type StandingsMap = Pick<typeof mapRows.$inferSelect, "matchId" | "isCompleted" | "isForfeit" | "teamAScore" | "teamBScore">;

const emptyMapRecord = (): MapRecord => ({ mapWins: 0, mapLosses: 0, roundWins: 0, roundLosses: 0 });

/** One map seen from each side, null when it has no result. A forfeited map counts as a map,
 *  but its score is not a round count. */
function mapResult(mp: StandingsMap): { a: MapRecord; b: MapRecord } | null {
  if (!mp.isCompleted || mp.teamAScore === null || mp.teamBScore === null) return null;
  const aWon = mp.teamAScore > mp.teamBScore ? 1 : 0;
  const bWon = mp.teamBScore > mp.teamAScore ? 1 : 0;
  const roundsA = mp.isForfeit ? 0 : mp.teamAScore;
  const roundsB = mp.isForfeit ? 0 : mp.teamBScore;
  return {
    a: { mapWins: aWon, mapLosses: bWon, roundWins: roundsA, roundLosses: roundsB },
    b: { mapWins: bWon, mapLosses: aWon, roundWins: roundsB, roundLosses: roundsA },
  };
}

/**
 * Map and round totals per entrant, plus the head to head record of every pair over their
 * completed matches. Same `entrantAId`/`entrantBId` <-> `teamAScore`/`teamBScore` convention
 * as `points.ts`.
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

  for (const mp of containerMaps) {
    const match = matchById.get(mp.matchId);
    const result = mapResult(mp);
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

async function loadGroupRecords(tx: Tx, containerId: number) {
  const containerMatches = await tx.select().from(matches).where(eq(matches.containerId, containerId));
  const containerMaps = containerMatches.length ? await tx.select().from(mapRows).where(inArray(mapRows.matchId, containerMatches.map((m) => m.id))) : [];
  return groupRecords(containerMatches, containerMaps);
}

/** Ranked standings for a group container, using the calculator that
 *  matches its configured format (swiss vs round robin). Wins/losses are
 *  derived from the matches, and an entrant playing in the group without a
 *  `group_entries` row is still listed. */
export async function computeContainerStandings(tx: Tx, containerId: number, rawConfig: unknown): Promise<GroupStandingsEntry[]> {
  const config = parseGroupConfig(rawConfig);
  const [storedEntries, matchRecord, points, records] = await Promise.all([
    tx.select().from(groupEntries).where(eq(groupEntries.containerId, containerId)),
    recordsFromMatches(tx, containerId),
    config.pointsConfig ? computeContainerPoints(tx, containerId, config.pointsConfig) : null,
    loadGroupRecords(tx, containerId),
  ]);
  const storedById = new Map(storedEntries.map((e) => [e.entrantId, e]));
  const entrantIds = [...new Set([...storedById.keys(), ...matchRecord.keys()])];

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

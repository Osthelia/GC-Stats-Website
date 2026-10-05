/**
 * GC-Stats - standings
 *
 * Computes ranked group standings (swiss, round robin) with map/round
 * records read at request time from `maps`, not trusted from `group_entries`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray } from "drizzle-orm";
import { groupEntries, matches, maps as mapRows } from "@gc-stats/db";
import { createSwissStandings, createRoundRobinStandings, type RankedStandingsEntry, type StandingsEntry } from "@gc-stats/bracket-engine";
import type { Tx } from "./repository";
import { parseGroupConfig } from "./config-types";
import { computeContainerPoints } from "./points";
import { recordsFromMatches } from "./group-progression";

export type GroupStandingsEntry = RankedStandingsEntry & { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };

type MapRecord = { mapWins: number; mapLosses: number; roundWins: number; roundLosses: number };

/**
 * Per-entrant map record (win/loss) and round win/loss totals, computed
 * read-time from `maps` (same `matches.entrantAId`/`entrantBId` <->
 * `maps.teamAScore`/`teamBScore` convention as `points.ts`) rather than
 * trusted from `group_entries` — that column is match-level bookkeeping
 * only (never updated with map/round data, cf. group-progression.ts) and,
 * for historically-migrated containers, was reconstructed at 0 anyway
 * (SUIVI.md, 2026-09-12 group_entries backfill). Round totals exclude
 * forfeited maps (mirrors V1's `TournamentStandings::compute`, which never
 * sees a forfeit's non-real score to begin with) — a `-1` isn't a real
 * round count and would otherwise skew the differential.
 */
async function computeMapRecord(tx: Tx, containerId: number): Promise<Map<number, MapRecord>> {
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

  const containerMatches = await tx.select().from(matches).where(eq(matches.containerId, containerId));
  if (containerMatches.length === 0) return stats;
  const matchById = new Map(containerMatches.map((m) => [m.id, m]));

  const containerMaps = await tx.select().from(mapRows).where(inArray(mapRows.matchId, containerMatches.map((m) => m.id)));
  for (const mp of containerMaps) {
    if (!mp.isCompleted || mp.teamAScore === null || mp.teamBScore === null) continue;
    const match = matchById.get(mp.matchId);
    if (!match) continue;
    if (mp.teamAScore > mp.teamBScore) {
      bump(match.entrantAId, { mapWins: 1 });
      bump(match.entrantBId, { mapLosses: 1 });
    } else if (mp.teamBScore > mp.teamAScore) {
      bump(match.entrantBId, { mapWins: 1 });
      bump(match.entrantAId, { mapLosses: 1 });
    }
    if (!mp.isForfeit) {
      bump(match.entrantAId, { roundWins: mp.teamAScore, roundLosses: mp.teamBScore });
      bump(match.entrantBId, { roundWins: mp.teamBScore, roundLosses: mp.teamAScore });
    }
  }
  return stats;
}

/** Ranked standings for a group container, using the calculator that
 *  matches its configured format (swiss vs round robin). Wins/losses are
 *  derived from the matches, and an entrant playing in the group without a
 *  `group_entries` row is still listed. */
export async function computeContainerStandings(tx: Tx, containerId: number, rawConfig: unknown): Promise<GroupStandingsEntry[]> {
  const config = parseGroupConfig(rawConfig);
  const [storedEntries, matchRecord, points, mapRecord, completedMatches] = await Promise.all([
    tx.select().from(groupEntries).where(eq(groupEntries.containerId, containerId)),
    recordsFromMatches(tx, containerId),
    config.pointsConfig ? computeContainerPoints(tx, containerId, config.pointsConfig) : null,
    computeMapRecord(tx, containerId),
    // Head to head input, only read by round robin.
    config.type === "swiss"
      ? []
      : tx
          .select()
          .from(matches)
          .where(and(eq(matches.containerId, containerId), eq(matches.status, "completed"))),
  ]);
  const storedById = new Map(storedEntries.map((e) => [e.entrantId, e]));
  const entrantIds = [...new Set([...storedById.keys(), ...matchRecord.keys()])];
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

  // round_robin: build head-to-head from completed matches in this container.
  const dtos: StandingsEntry[] = entries.map((e) => {
    const headToHead = new Map<string, "win" | "loss">();
    for (const m of completedMatches) {
      if (m.entrantAId === e.entrantId && m.entrantBId !== null) {
        headToHead.set(String(m.entrantBId), m.winnerId === e.entrantId ? "win" : "loss");
      } else if (m.entrantBId === e.entrantId && m.entrantAId !== null) {
        headToHead.set(String(m.entrantAId), m.winnerId === e.entrantId ? "win" : "loss");
      }
    }
    return {
      id: String(e.entrantId),
      seed: e.seed ?? 0,
      wins: e.wins,
      losses: e.losses,
      buchholz: e.buchholz,
      roundDiff: roundDiffOf(e.entrantId),
      headToHead,
      points: points?.get(e.entrantId) ?? 0,
    };
  });
  return withMapRecord(createRoundRobinStandings({ tiebreakers: config.tiebreakers }).recompute(dtos));
}

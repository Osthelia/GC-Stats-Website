/**
 * GC-Stats — timeline-stats module
 *
 * Stats computed from a game's timeline rows: lane diffs at 10 and 15 minutes,
 * first blood, first tower, and when each objective kind was first taken per
 * side. Pure, no I/O. A lane diff is the player minus their lane opponent
 * (same role, other side), so a positive value means the player is ahead.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { otherSide, type LeagueSide } from "./game-summary";
import type { LeagueFrameRow, LeagueTimelineRows } from "./timeline-rows";

export interface LanePlayer {
  personId: number;
  side: LeagueSide;
  role: string | null; // Riot teamPosition, null when unknown
}

export interface LaneDiffs {
  goldDiff10: number | null;
  goldDiff15: number | null;
  xpDiff10: number | null;
  xpDiff15: number | null;
  csDiff10: number | null;
  csDiff15: number | null;
}

export interface FirstEvent {
  side: LeagueSide;
  timeMs: number;
}

export interface FirstBlood extends FirstEvent {
  personId: number;
}

/** Riot's first time each objective kind (DRAGON, BARON_NASHOR, HORDE…) was taken, in ms, per side. */
export type ObjectiveTimings = Record<LeagueSide, Record<string, number>>;

type FrameStat = "totalGold" | "xp" | "cs";

/**
 * Lane diffs at the 10- and 15-minute marks. Riot writes one frame per minute, so the frame
 * index is the minute. A player with no role, no lane opponent, or a game that ended before the
 * mark gets null.
 */
export function computeLaneDiffs(rows: LeagueTimelineRows, players: LanePlayer[]): Map<number, LaneDiffs> {
  const framesByPerson = new Map<number, Map<number, LeagueFrameRow>>();
  for (const row of rows.frames) {
    const frames = framesByPerson.get(row.personId) ?? new Map<number, LeagueFrameRow>();
    frames.set(row.frame, row);
    framesByPerson.set(row.personId, frames);
  }

  const diffAt = (personId: number, opponentId: number, minute: number, stat: FrameStat): number | null => {
    const mine = framesByPerson.get(personId)?.get(minute);
    const theirs = framesByPerson.get(opponentId)?.get(minute);
    return mine && theirs ? mine[stat] - theirs[stat] : null;
  };

  const diffs = new Map<number, LaneDiffs>();
  for (const player of players) {
    const opponent = players.find((p) => p.side !== player.side && p.role !== null && p.role === player.role);
    const diff = (minute: number, stat: FrameStat) => (opponent ? diffAt(player.personId, opponent.personId, minute, stat) : null);
    diffs.set(player.personId, {
      goldDiff10: diff(10, "totalGold"),
      goldDiff15: diff(15, "totalGold"),
      xpDiff10: diff(10, "xp"),
      xpDiff15: diff(15, "xp"),
      csDiff10: diff(10, "cs"),
      csDiff15: diff(15, "cs"),
    });
  }
  return diffs;
}

/** The first champion kill of the game: killer and time. */
export function computeFirstBlood(rows: LeagueTimelineRows): FirstBlood | null {
  const kill = rows.events.find((e) => e.type === "CHAMPION_KILL" && e.personId !== null && e.side !== null);
  if (!kill || kill.personId === null || kill.side === null) return null;
  return { personId: kill.personId, side: kill.side, timeMs: kill.timeMs };
}

/** The first tower destroyed. The row's side is the team that lost the tower, so the side returned is the other one. */
export function computeFirstTower(rows: LeagueTimelineRows): FirstEvent | null {
  const tower = rows.events.find((e) => e.type === "BUILDING_KILL" && e.subtype === "TOWER_BUILDING" && e.side !== null);
  if (!tower || tower.side === null) return null;
  return { side: otherSide(tower.side), timeMs: tower.timeMs };
}

/** For each side and objective kind, the time it was first taken. `ELITE_MONSTER_KILL` subtypes look like "DRAGON:WATER_DRAGON", so the kind is the part before the colon. */
export function computeObjectiveTimings(rows: LeagueTimelineRows): ObjectiveTimings {
  const timings: ObjectiveTimings = { blue: {}, red: {} };
  for (const e of rows.events) {
    if (e.type !== "ELITE_MONSTER_KILL" || e.side === null || e.subtype === null) continue;
    const kind = e.subtype.split(":")[0] ?? e.subtype;
    timings[e.side][kind] ??= e.timeMs;
  }
  return timings;
}


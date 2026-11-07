/**
 * GC-Stats — lanes module
 *
 * Lanes of a roster entry: keeping a stored set in lane order, taking the lanes a person played from their games
 * when none are stored, and ordering a roster by them. No database access, so the rules can be tested on their own.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { LEAGUE_ROLES, type LeagueRole } from "./game-summary";

const LANE_RANK = new Map<string, number>(LEAGUE_ROLES.map((lane, i) => [lane, i]));

export function isLane(value: string | null | undefined): value is LeagueRole {
  return value != null && LANE_RANK.has(value);
}

/** True when the value is a list of lanes. Takes any value, as its callers get it from a client or a stored request. */
export function areLanes(values: unknown): boolean {
  return Array.isArray(values) && values.every((value) => typeof value === "string" && isLane(value));
}

/** The position of a lane (Top 0 to Support 4). Anything that is not a lane, or no lane at all, ranks after Support. */
export function laneRank(lane: string | null | undefined): number {
  return LANE_RANK.get(lane ?? "") ?? LEAGUE_ROLES.length;
}

/** The lanes once each, in lane order (Top to Support). Anything that is not a lane is dropped. */
export function sortLanes(lanes: Iterable<string | null | undefined>): LeagueRole[] {
  const set = new Set<string>();
  for (const lane of lanes) if (isLane(lane)) set.add(lane);
  return LEAGUE_ROLES.filter((lane) => set.has(lane));
}

/** A lane played on one day. */
export interface PlayedLane {
  lane: string | null;
  /** The day the game was played (UTC, YYYY-MM-DD). A game without a date cannot be placed in a period. */
  day: string | null;
}

/**
 * The lanes played within a roster entry's period, in lane order like saved lanes (Top to Support), so the icons and
 * the roster order do not depend on whether an admin saved the lanes. `since` is the first day of the period and
 * `until` the day after the last one (null for an open period), the way the daterange is stored. An entry that was
 * left with an unknown end (`hasLeft` without `until`) has no known period, so it gets no lanes from games.
 */
export function lanesPlayedInPeriod(played: readonly PlayedLane[], period: { since: string | null; until: string | null; hasLeft: boolean }): LeagueRole[] {
  if (period.hasLeft && period.until === null) return [];
  const inPeriod = played.filter(({ day }) => day !== null && (period.since === null || day >= period.since) && (period.until === null || day < period.until));
  return sortLanes(inPeriod.map(({ lane }) => lane));
}

/** Orders by first lane (Top to Support), people without a lane last. Equal ranks stay as they were (stable sort). */
export function compareByLanes(a: readonly string[], b: readonly string[]): number {
  return laneRank(a[0]) - laneRank(b[0]);
}

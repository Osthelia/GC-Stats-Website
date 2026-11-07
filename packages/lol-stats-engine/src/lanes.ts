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

/** True when every value is one of the five lanes. */
export function areLanes(values: readonly string[]): boolean {
  return values.every((value) => isLane(value));
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

export function lanesByCount(played: Iterable<string | null | undefined>): LeagueRole[] {
  const counts = new Map<LeagueRole, number>();
  for (const lane of played) if (isLane(lane)) counts.set(lane, (counts.get(lane) ?? 0) + 1);
  return sortLanes(counts.keys()).sort((a, b) => counts.get(b)! - counts.get(a)!);
}

export interface PlayedLane {
  lane: string | null;
  playedAt: Date | null;
}

export function lanesPlayedInPeriod(games: readonly PlayedLane[], period: { since: string | null; until: string | null; hasLeft: boolean }): LeagueRole[] {
  if (period.hasLeft && period.until === null) return [];
  const inPeriod = games.filter((game) => {
    if (!game.playedAt) return false;
    const day = game.playedAt.toISOString().slice(0, 10);
    return (period.since === null || day >= period.since) && (period.until === null || day < period.until);
  });
  return lanesByCount(inPeriod.map((game) => game.lane));
}

/** Orders by first lane (Top to Support), people without a lane last. Equal ranks stay as they were (stable sort). */
export function compareByLanes(a: readonly string[], b: readonly string[]): number {
  return laneRank(a[0]) - laneRank(b[0]);
}

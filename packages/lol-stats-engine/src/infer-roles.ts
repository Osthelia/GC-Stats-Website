/**
 * GC-Stats — infer-roles module
 *
 * Works out each player's role from where they stand in the first minutes of the timeline. Riot's own
 * teamPosition is unreliable for esports games (it is AFK for one player per team, and often on the wrong
 * player), so the stats use this instead, and the admin can override it per player.
 *
 * Each team gets one player per role. Every player is compared with a point on the map for each role, and
 * the cheapest assignment of the five roles wins (120 permutations). The two bottom-lane players share a
 * point, so the one who farmed more by minute 5 is the bottom laner and the other is support.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotMatchDto, RiotParticipantFrameDto, RiotTimelineDto, RiotTeamId } from "./types";
import { roleOf, sideForTeamId, type LeagueSide } from "./game-summary";

export const LEAGUE_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type LeagueRole = (typeof LEAGUE_ROLES)[number];

type Point = { x: number; y: number };

// Map positions (Summoner's Rift, about 15000 units square). The lanes are the same for both teams; the
// jungle is on each team's own side, so its point is mirrored.
const LANE_POINT: Record<Exclude<LeagueRole, "JUNGLE">, Point> = {
  TOP: { x: 1700, y: 11800 },
  MIDDLE: { x: 7500, y: 7500 },
  BOTTOM: { x: 12500, y: 2600 },
  UTILITY: { x: 12500, y: 2600 },
};
const JUNGLE_POINT: Record<LeagueSide, Point> = {
  blue: { x: 4500, y: 5500 },
  red: { x: 10500, y: 9500 },
};

// Minutes 1 to 5 (frame index = minute). Spawn and recall positions near either base are left out.
const SAMPLE_FRAMES = [1, 2, 3, 4, 5];
const BASE_RADIUS = 2000;
const BLUE_BASE: Point = { x: 0, y: 0 };
const RED_BASE: Point = { x: 15000, y: 15000 };

/**
 * Role per participant id, or null when the timeline is missing or a player has no usable position in
 * the first five minutes (the caller then keeps Riot's teamPosition).
 */
export function inferRoles(match: RiotMatchDto, timeline: RiotTimelineDto | null): Map<number, LeagueRole> | null {
  if (!timeline) return null;
  const roles = new Map<number, LeagueRole>();

  for (const teamId of [100, 200] as RiotTeamId[]) {
    const side = sideForTeamId(teamId);
    const players = match.info.participants.filter((p) => p.teamId === teamId);
    if (players.length !== 5) return null;

    const samples = players.map((p) => samplesOf(timeline, p.participantId));
    if (samples.some((s) => s === null)) return null;
    const costed = players.map((p, i) => ({ id: p.participantId, point: average(samples[i]!), cs: cumulativeCs(timeline, p.participantId, 5) }));

    const assignment = cheapestAssignment(costed.map((c) => c.point), side);
    const byRole = new Map<LeagueRole, (typeof costed)[number]>();
    assignment.forEach((role, i) => byRole.set(role, costed[i]!));

    // The bottom lane pair: the one with more minions by minute 5 is the bottom laner.
    const [adc, support] = [byRole.get("BOTTOM")!, byRole.get("UTILITY")!].sort((a, b) => b.cs - a.cs);
    for (const role of LEAGUE_ROLES) {
      const player = role === "BOTTOM" ? adc! : role === "UTILITY" ? support! : byRole.get(role)!;
      roles.set(player.id, role);
    }
  }
  return roles;
}

/**
 * The role of every participant, by participant id. An override (keyed by puuid) wins, null included, so the
 * admin can clear a role. Otherwise the inferred role, or Riot's teamPosition when inference is not possible.
 */
export function resolvePlayerRoles(match: RiotMatchDto, timeline: RiotTimelineDto | null, overrides: Record<string, string | null> = {}): Map<number, string | null> {
  const inferred = inferRoles(match, timeline);
  const roles = new Map<number, string | null>();
  for (const p of match.info.participants) {
    const override = overrides[p.puuid];
    roles.set(p.participantId, override !== undefined ? override : (inferred?.get(p.participantId) ?? roleOf(p.teamPosition)));
  }
  return roles;
}

/** Positions in the sampled minutes, leaving out the base areas. Null when there are none. */
function samplesOf(timeline: RiotTimelineDto, participantId: number): Point[] | null {
  const points: Point[] = [];
  for (const frameIndex of SAMPLE_FRAMES) {
    const frame = timeline.info.frames[frameIndex];
    const pf = frame?.participantFrames[String(participantId)];
    if (!pf) continue;
    if (near(pf.position, BLUE_BASE) || near(pf.position, RED_BASE)) continue;
    points.push({ x: pf.position.x, y: pf.position.y });
  }
  return points.length > 0 ? points : null;
}

function near(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < BASE_RADIUS;
}

function average(points: Point[]): Point {
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

function cumulativeCs(timeline: RiotTimelineDto, participantId: number, frameIndex: number): number {
  const pf: RiotParticipantFrameDto | undefined = timeline.info.frames[frameIndex]?.participantFrames[String(participantId)];
  return pf ? pf.minionsKilled + pf.jungleMinionsKilled : 0;
}

/** Role for each of the five players (same order as `points`) at the lowest total distance. */
function cheapestAssignment(points: Point[], side: LeagueSide): LeagueRole[] {
  let best: LeagueRole[] = [];
  let bestCost = Infinity;
  for (const roles of permutations(LEAGUE_ROLES)) {
    const cost = points.reduce((sum, point, i) => sum + distance(point, pointFor(roles[i]!, side)), 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = roles;
    }
  }
  return best;
}

function pointFor(role: LeagueRole, side: LeagueSide): Point {
  return role === "JUNGLE" ? JUNGLE_POINT[side] : LANE_POINT[role];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

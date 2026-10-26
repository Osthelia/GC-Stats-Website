/**
 * GC-Stats - config-types
 *
 * `stage_containers.config` is untyped jsonb at the schema level (kept
 * generic since the visual editor / future formats may need shapes we
 * haven't thought of yet), these are the shapes this resolution layer
 * actually understands, matching bracket-engine-spec-v2.md's comments on
 * the original `stageContainers.config` column.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { SwissTiebreaker } from "@osthelia/bracket-engine";

/** Points per match, map and round won or lost, they order the group when "points" is a tiebreaker.
 *  A forfeited match is worth the forfeit values alone. */
export const POINTS_FIELDS = ["matchWin", "matchLoss", "mapWin", "mapLoss", "roundWin", "roundLoss", "forfeitWin", "forfeitLoss"] as const;
export type PointsField = (typeof POINTS_FIELDS)[number];
export type StandingsPointsConfig = Record<PointsField, number>;

export const MAX_POINTS = 1000;

export const EMPTY_POINTS: StandingsPointsConfig = { matchWin: 0, matchLoss: 0, mapWin: 0, mapLoss: 0, roundWin: 0, roundLoss: 0, forfeitWin: 0, forfeitLoss: 0 };

// Tiebreakers a group format understands, wins always count first
export const SWISS_TIEBREAKERS = ["points", "buchholz", "map_diff", "round_diff", "seed"] as const;
export const ROUND_ROBIN_TIEBREAKERS = ["points", "map_diff", "round_diff", "head_to_head", "seed"] as const;
export type RoundRobinTiebreaker = (typeof ROUND_ROBIN_TIEBREAKERS)[number];

export interface SwissGroupConfig {
  type: "swiss";
  qualifyAtWins: number | null;
  eliminateAtLosses: number | null;
  maxRounds: number;
  roundFormat: Record<number, number>;
  tiebreakers: SwissTiebreaker[];
  pointsConfig: StandingsPointsConfig | null;
}

export interface RoundRobinGroupConfig {
  type: "round_robin";
  tiebreakers: RoundRobinTiebreaker[];
  pointsConfig: StandingsPointsConfig | null;
}

export type GroupContainerConfig = SwissGroupConfig | RoundRobinGroupConfig;

function isPointValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= MAX_POINTS;
}

// Older configs only had optional win values (null for none) and a map forfeit value, now dropped
function parsePointsConfig(raw: unknown): StandingsPointsConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (!("matchLoss" in c)) {
    const legacy = { matchWin: c.matchWin, mapWin: c.mapWin, roundWin: c.roundWin, forfeitWin: c.matchForfeitWin };
    if (Object.values(legacy).every((v) => v === null || v === undefined)) return null;
    return { ...EMPTY_POINTS, ...Object.fromEntries(Object.entries(legacy).map(([k, v]) => [k, isPointValue(v) ? v : 0])) };
  }
  return Object.fromEntries(POINTS_FIELDS.map((f) => [f, isPointValue(c[f]) ? c[f] : 0])) as StandingsPointsConfig;
}

export function parseGroupConfig(config: unknown): GroupContainerConfig {
  if (!config || typeof config !== "object" || !("type" in config)) {
    throw new Error("parseGroupConfig: container.config is missing a \"type\" discriminant");
  }
  const type = (config as { type: unknown }).type;
  if (type === "swiss") {
    const c = config as Partial<SwissGroupConfig>;
    return {
      type: "swiss",
      qualifyAtWins: c.qualifyAtWins ?? null,
      eliminateAtLosses: c.eliminateAtLosses ?? null,
      maxRounds: c.maxRounds ?? 5,
      roundFormat: c.roundFormat ?? {},
      tiebreakers: c.tiebreakers ?? ["buchholz", "round_diff", "seed"],
      pointsConfig: parsePointsConfig(c.pointsConfig),
    };
  }
  if (type === "round_robin") {
    const c = config as Partial<RoundRobinGroupConfig>;
    return { type: "round_robin", tiebreakers: c.tiebreakers ?? ["round_diff", "seed"], pointsConfig: parsePointsConfig(c.pointsConfig) };
  }
  throw new Error(`parseGroupConfig: unknown group config type "${String(type)}"`);
}

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
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { SwissTiebreaker } from "@gc-stats/bracket-engine";

/**
 * Configurable points-based tiebreaker (2026-08-31, explicit user spec):
 * award points for match wins / map wins / round wins, with separate
 * (typically lower) values for a win that came from a forfeit rather than
 * actually being played. Every field is independently optional — `null`
 * means "don't award points for this" — so a container can use just one
 * dimension (e.g. only match wins) or combine several.
 */
export interface StandingsPointsConfig {
  matchWin: number | null;
  mapWin: number | null;
  roundWin: number | null;
  matchForfeitWin: number | null;
  mapForfeitWin: number | null;
}

export function isPointsConfigActive(config: StandingsPointsConfig | null): boolean {
  if (!config) return false;
  return config.matchWin !== null || config.mapWin !== null || config.roundWin !== null || config.matchForfeitWin !== null || config.mapForfeitWin !== null;
}

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
  tiebreakers: ("round_diff" | "head_to_head" | "seed")[];
  pointsConfig: StandingsPointsConfig | null;
}

export type GroupContainerConfig = SwissGroupConfig | RoundRobinGroupConfig;

function parsePointsConfig(raw: unknown): StandingsPointsConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<StandingsPointsConfig>;
  return {
    matchWin: c.matchWin ?? null,
    mapWin: c.mapWin ?? null,
    roundWin: c.roundWin ?? null,
    matchForfeitWin: c.matchForfeitWin ?? null,
    mapForfeitWin: c.mapForfeitWin ?? null,
  };
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

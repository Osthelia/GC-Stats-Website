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

import { GAME_CHANGERS_TIEBREAKERS, type RoundRobinTiebreaker, type SwissStandingsTiebreaker } from "@osthelia/bracket-engine";
import { gameHasMaps, type GameSlug } from "@gc-stats/db/game";

/** Points per match, map and round won or lost, when set they order the group before anything else.
 *  A forfeited match is worth the forfeit values alone. */
export const POINTS_FIELDS = ["matchWin", "matchLoss", "mapWin", "mapLoss", "roundWin", "roundLoss", "forfeitWin", "forfeitLoss"] as const;
export type PointsField = (typeof POINTS_FIELDS)[number];
export type StandingsPointsConfig = Record<PointsField, number>;

export const MAX_POINTS = 1000;

export const EMPTY_POINTS: StandingsPointsConfig = { matchWin: 0, matchLoss: 0, mapWin: 0, mapLoss: 0, roundWin: 0, roundLoss: 0, forfeitWin: 0, forfeitLoss: 0 };

// Tiebreakers a group format understands, applied after the match record
export const ROUND_ROBIN_TIEBREAKERS = ["points", "head_to_head", "h2h_map_diff", "h2h_round_diff", "map_diff", "round_diff", "seed"] as const satisfies readonly RoundRobinTiebreaker[];
export const SWISS_TIEBREAKERS = [...ROUND_ROBIN_TIEBREAKERS, "buchholz"] as const satisfies readonly SwissStandingsTiebreaker[];

/** Order applied to a new group, and to one that has none of its own. */
export const DEFAULT_TIEBREAKERS = GAME_CHANGERS_TIEBREAKERS;

/**
 * Which matches a group's table counts. `"container"` (default, and the only
 * behaviour before this key existed) lists anyone who played a match stored in the group.
 * `"stage"` lists only the pinned teams and counts their completed matches in
 * any container of the same stage, for tournaments whose groups also play
 * each other. Round robin only.
 */
export type GroupMatchScope = "container" | "stage";

/**
 * Whether a container's matches count towards a stage-scoped group: only those of
 * the stage's other stage-scoped groups. A group that keeps to its own matches
 * never adds them to another group's table.
 */
export function countsForStageScope(container: { containerType: string; config: unknown }): boolean {
  return container.containerType === "group" && usesStageScope(container.config);
}

/** Whether a group's raw config opts in to stage scope. Safe on a missing or malformed config (legacy or converted containers), unlike `parseGroupConfig`. */
export function usesStageScope(config: unknown): boolean {
  const c = config as { type?: string; matchScope?: string } | null;
  return c?.type === "round_robin" && c.matchScope === "stage";
}

export interface SwissGroupConfig {
  type: "swiss";
  matchScope: GroupMatchScope;
  qualifyAtWins: number | null;
  eliminateAtLosses: number | null;
  maxRounds: number;
  roundFormat: Record<number, number>;
  tiebreakers: SwissStandingsTiebreaker[];
  pointsConfig: StandingsPointsConfig | null;
}

export interface RoundRobinGroupConfig {
  type: "round_robin";
  matchScope: GroupMatchScope;
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

// A game without maps has no rounds, so the round based tiebreakers never apply to it.
const fitsGame = (game: GameSlug) => (tiebreaker: string) => gameHasMaps(game) || (tiebreaker !== "round_diff" && tiebreaker !== "h2h_round_diff");

/** Tiebreakers an admin can pick for a group format of this game. */
export function allowedTiebreakers(game: GameSlug, format: GroupContainerConfig["type"]): SwissStandingsTiebreaker[] {
  return (format === "swiss" ? SWISS_TIEBREAKERS : ROUND_ROBIN_TIEBREAKERS).filter(fitsGame(game));
}

export function defaultTiebreakers(game: GameSlug): RoundRobinTiebreaker[] {
  return DEFAULT_TIEBREAKERS.filter(fitsGame(game));
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
      matchScope: "container",
      qualifyAtWins: c.qualifyAtWins ?? null,
      eliminateAtLosses: c.eliminateAtLosses ?? null,
      maxRounds: c.maxRounds ?? 5,
      roundFormat: c.roundFormat ?? {},
      tiebreakers: c.tiebreakers ?? [...DEFAULT_TIEBREAKERS],
      pointsConfig: parsePointsConfig(c.pointsConfig),
    };
  }
  if (type === "round_robin") {
    const c = config as Partial<RoundRobinGroupConfig>;
    return {
      type: "round_robin",
      matchScope: c.matchScope === "stage" ? "stage" : "container",
      tiebreakers: c.tiebreakers ?? [...DEFAULT_TIEBREAKERS],
      pointsConfig: parsePointsConfig(c.pointsConfig),
    };
  }
  throw new Error(`parseGroupConfig: unknown group config type "${String(type)}"`);
}

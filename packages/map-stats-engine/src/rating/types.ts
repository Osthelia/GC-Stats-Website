/**
 * GC-Stats - rating types
 *
 * Source-neutral input of the GCS rating (buildable from a Riot match or
 * from the RAW tables) and the serialized rating model.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotTeamId } from "../types";

export type AgentRole = "duelist" | "initiator" | "controller" | "sentinel";

export type RatingSide = "atk" | "def";

export const RATING_COMPONENTS = ["imp", "kil", "srv", "dmg", "kst", "ast", "opn"] as const;
export type RatingComponent = (typeof RATING_COMPONENTS)[number];

export interface RatingPlayer {
  /** puuid at ingestion, person id when rebuilt from RAW rows. */
  id: string;
  team: RiotTeamId;
  /** Normalized agent key (see agentKey()), null when unknown. */
  agent: string | null;
  role: AgentRole | null;
}

/** "self": killed by their own utility (penalized); "environment": fall, bomb or map damage such as crush (neutral). */
export type RatingKillCause = "player" | "self" | "environment";

export interface RatingKill {
  timeMs: number;
  cause: RatingKillCause;
  /** null = environmental or self death. */
  killer: string | null;
  victim: string;
  assistants: string[];
}

export interface RatingDamage {
  attacker: string;
  receiver: string;
  damage: number;
}

export interface RatingRound {
  roundNum: number;
  atkTeam: RiotTeamId;
  winnerTeam: RiotTeamId;
  plantTimeMs: number | null;
  planter: string | null;
  defuser: string | null;
  /** Loadout value at round start, by player id. */
  loadouts: Record<string, number>;
  kills: RatingKill[];
  damages: RatingDamage[];
}

export interface RatingMapInput {
  players: RatingPlayer[];
  rounds: RatingRound[];
}

/** Per player, per side: rounds played and the numerator of every component (component = sum / rounds). */
export interface RatingSideSums {
  rounds: number;
  sums: Record<RatingComponent, number>;
}

export interface RatingPlayerRecord {
  id: string;
  agent: string | null;
  role: AgentRole | null;
  sides: Record<RatingSide, RatingSideSums>;
  clutchesWon: number;
  /** Sum of CLUTCH_BONUS_BY_OPPONENTS over won clutches. */
  clutchPoints: number;
}

/** Win probability table: state key to [visits, attacker wins]. */
export type WinProbCounts = Record<string, [number, number]>;

export interface BaselineStat {
  /** Rounds behind the means. */
  rounds: number;
  /** Maps behind the standard deviation. */
  maps: number;
  mean: Record<RatingSide, Record<RatingComponent, number>>;
  sd: Record<RatingComponent, number>;
}

export interface RatingBaselines {
  global: BaselineStat;
  role: Partial<Record<AgentRole, BaselineStat>>;
  agent: Record<string, BaselineStat>;
}

export interface RatingModel {
  /** Rating formula version, bumped when the code of the formula changes. */
  formulaVersion: number;
  winProb: WinProbCounts;
  baselines: RatingBaselines;
  /** Scale applied to the weighted z sum, calibrated so the per-map rating SD is RATING_TARGET_SD. */
  k: number;
}

export interface RatingResult {
  id: string;
  rating: number;
  rounds: number;
  /** Per component: raw per-round value and its z-score against the expected value. */
  components: Record<RatingComponent, { value: number; z: number }>;
  /** Bonus added on top of the calibrated rating for won clutches. */
  clutch: { won: number; bonus: number };
}

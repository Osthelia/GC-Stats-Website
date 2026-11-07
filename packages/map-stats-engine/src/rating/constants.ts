/**
 * GC-Stats - rating constants
 *
 * Every tunable of the GCS rating, see RATING.md for the reasoning.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { AgentRole, RatingComponent } from "./types";

/** Bump when the formula itself changes (not when the model is only recomputed). */
export const RATING_FORMULA_VERSION = 2;

export const RATING_TARGET_SD = 0.4;
export const RATING_Z_CLAMP = 3;

/** Win probability smoothing strength (pseudo visits toward the coarser state). */
export const WIN_PROB_ALPHA = 20;

/** Rating bonus per won clutch, by opponents alive when it started, for a map of CLUTCH_REFERENCE_ROUNDS rounds. */
export const CLUTCH_BONUS_BY_OPPONENTS: Record<number, number> = { 1: 0.03, 2: 0.06, 3: 0.1, 4: 0.15, 5: 0.2 };
/** Clutch bonuses scale with REFERENCE / rounds played, so a clutch weighs the same share of any map. */
export const CLUTCH_REFERENCE_ROUNDS = 20;

/** Assist shares of a kill's win probability delta. */
export const UTILITY_ASSIST_SHARE = 0.25;
export const DAMAGE_ASSIST_SHARE = 0.15;
export const MAX_ASSIST_SHARE = 0.5;

/** A traded death costs this fraction of an untraded one. */
export const TRADED_DEATH_FACTOR = 0.5;
/** Damage assists count this fraction of a utility assist in AST (ADR already rewards the damage). */
export const DAMAGE_ASSIST_WEIGHT = 0.5;

export const ECO_FACTOR_MIN = 0.6;
export const ECO_FACTOR_MAX = 1.4;
/** Loadout floor so a Classic with no armor never divides by zero. */
export const ECO_LOADOUT_FLOOR = 400;

/** Baseline shrinkage strength, in rounds: agent toward role, role toward global. */
export const AGENT_SHRINK_ROUNDS = 2000;
export const ROLE_SHRINK_ROUNDS = 5000;
/** Maps shorter than this are left out of the standard deviations (too noisy). */
export const SD_MIN_ROUNDS = 10;

export const ROLE_WEIGHTS: Record<AgentRole, Record<RatingComponent, number>> = {
  duelist: {
    imp: 0.3,
    kil: 0.18,
    srv: 0.07,
    dmg: 0.1,
    kst: 0.07,
    ast: 0.03,
    opn: 0.25,
  },
  initiator: {
    imp: 0.3,
    kil: 0.12,
    srv: 0.08,
    dmg: 0.08,
    kst: 0.13,
    ast: 0.2,
    opn: 0.09,
  },
  controller: {
    imp: 0.3,
    kil: 0.14,
    srv: 0.16,
    dmg: 0.08,
    kst: 0.18,
    ast: 0.1,
    opn: 0.04,
  },
  sentinel: {
    imp: 0.3,
    kil: 0.14,
    srv: 0.16,
    dmg: 0.08,
    kst: 0.16,
    ast: 0.06,
    opn: 0.1,
  },
};

/** Unknown role: plain average of the four roles. */
export const FALLBACK_WEIGHTS: Record<RatingComponent, number> = {
  imp: 0.3,
  kil: 0.145,
  srv: 0.1175,
  dmg: 0.085,
  kst: 0.135,
  ast: 0.0975,
  opn: 0.12,
};

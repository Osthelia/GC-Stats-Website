/**
 * GC-Stats - scoring
 *
 * Pure scoring functions for pick'em: points for bracket match picks
 * (team correct plus winner correct, scaled by round), group match picks
 * and standing picks.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type PhaseScoringConfig = {
  teamCorrectPoints: number;
  outcomeCorrectPoints: number;
  advancementPerRoundPoints: number;
  standingRankPoints: number;
  groupMatchPoints: number;
};

/** Used by every stage unless a group opts into a custom per-phase override. */
export const DEFAULT_PICKEM_SCORING: PhaseScoringConfig = {
  teamCorrectPoints: 0,
  outcomeCorrectPoints: 4,
  advancementPerRoundPoints: 2,
  standingRankPoints: 3,
  groupMatchPoints: 3,
};

/** Points of a correct winner on a match of this round, before the wrong opponent halving. */
function winnerPoints(round: number, config: PhaseScoringConfig): number {
  return config.outcomeCorrectPoints + config.advancementPerRoundPoints * round;
}

/** Best possible score of a pick on a match of this round. */
export function bracketMatchMaxPoints(round: number, config: PhaseScoringConfig): number {
  return config.teamCorrectPoints + winnerPoints(round, config);
}

/**
 * Points for one bracket match pick, two independent parts:
 * - team correct: one of the two predicted teams really plays the match;
 * - winner correct: full points with the right opponent too, half otherwise.
 * Winner points are kept even by validation, rounding up only covers older odd configs.
 */
export function scoreBracketMatchPick(params: {
  predictedWinnerId: number;
  predictedOpponentId: number | null;
  round: number;
  actualEntrantAId: number | null;
  actualEntrantBId: number | null;
  actualWinnerId: number | null;
  config: PhaseScoringConfig;
}): number {
  const { predictedWinnerId, predictedOpponentId, round, actualEntrantAId, actualEntrantBId, actualWinnerId, config } = params;
  if (actualEntrantAId === null || actualEntrantBId === null) return 0;

  const isReal = (id: number | null) => id !== null && (id === actualEntrantAId || id === actualEntrantBId);
  let score = 0;
  if (isReal(predictedWinnerId) || isReal(predictedOpponentId)) score += config.teamCorrectPoints;
  if (actualWinnerId !== null && actualWinnerId === predictedWinnerId) {
    const full = winnerPoints(round, config);
    score += isReal(predictedOpponentId) ? full : Math.ceil(full / 2);
  }
  return score;
}

/** Points for one group/Swiss standing pick — exact predicted rank only. */
export function scoreStandingPick(predictedRank: number, actualRank: number | null, config: PhaseScoringConfig): number {
  if (actualRank === null) return 0;
  return predictedRank === actualRank ? config.standingRankPoints : 0;
}

/** Points for one Swiss/round robin match pick, right winner only. */
export function scoreGroupMatchPick(predictedWinnerId: number, actualWinnerId: number | null, config: PhaseScoringConfig): number {
  return actualWinnerId !== null && actualWinnerId === predictedWinnerId ? config.groupMatchPoints : 0;
}

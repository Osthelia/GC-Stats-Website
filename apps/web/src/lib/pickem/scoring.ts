/**
 * GC-Stats - scoring
 *
 * Pure scoring functions for pick'em: points for bracket match picks
 * (team correct plus outcome correct, scaled by round) and standing picks.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type PhaseScoringConfig = {
  teamCorrectPoints: number;
  outcomeCorrectPoints: number;
  advancementPerRoundPoints: number;
  standingRankPoints: number;
};

/** Used by every stage unless a group opts into a custom per-phase override. */
export const DEFAULT_PICKEM_SCORING: PhaseScoringConfig = {
  teamCorrectPoints: 1,
  outcomeCorrectPoints: 3,
  advancementPerRoundPoints: 2,
  standingRankPoints: 3,
};

/**
 * Points for one bracket match pick, stacking two independent signals: did
 * the user get one of the two teams right (regardless of the winner), and
 * did they get the winner right (scaled by round — a correct call deep in
 * the bracket is worth more, and naturally compounds since a team can only
 * reach round N in reality by having won every round before it).
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

  const realSet = new Set([actualEntrantAId, actualEntrantBId]);
  const predictedSet = [predictedWinnerId, predictedOpponentId].filter((id): id is number => id !== null);

  let score = 0;
  if (predictedSet.some((id) => realSet.has(id))) score += config.teamCorrectPoints;
  if (actualWinnerId !== null && actualWinnerId === predictedWinnerId) {
    score += config.outcomeCorrectPoints + config.advancementPerRoundPoints * round;
  }
  return score;
}

/** Points for one group/Swiss standing pick — exact predicted rank only. */
export function scoreStandingPick(predictedRank: number, actualRank: number | null, config: PhaseScoringConfig): number {
  if (actualRank === null) return 0;
  return predictedRank === actualRank ? config.standingRankPoints : 0;
}

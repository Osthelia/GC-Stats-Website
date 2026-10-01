/**
 * GC-Stats — sides module
 *
 * Resolves which team is attacking/defending each round, including the
 * halftime swap, the overtime alternating pattern, and a fallback for
 * rounds missing Riot's winningTeamRole field.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { RiotMatchPlayerDto, RiotRoundResultDto, RiotTeamId } from "./types";

export const FIRST_HALF_ROUNDS = 12;

export function otherTeam(team: RiotTeamId): RiotTeamId {
  return team === "Red" ? "Blue" : "Red";
}

/**
 * Fallback for the rare case a round is missing `winningTeamRole` (real
 * match-v1 responses always have it — this only guards against older/
 * malformed data): the team that planted first in the first half is that
 * half's attacker, mirroring V1's MapStatsCalculator::firstHalfAttackerColor.
 */
export function firstHalfAttackerFallback(rounds: RiotRoundResultDto[], players: RiotMatchPlayerDto[]): RiotTeamId {
  const teamByPuuid = new Map(players.map((p) => [p.puuid, p.teamId]));
  for (const round of rounds) {
    if (round.roundNum >= FIRST_HALF_ROUNDS) break;
    if (round.bombPlanter) {
      const team = teamByPuuid.get(round.bombPlanter);
      if (team) return team;
    }
  }
  return players[0]?.teamId ?? "Red";
}

/** First half / swap at halftime / alternate every round in OT — same shape as V1. */
function heuristicAttackerForRound(roundNum: number, firstHalfAttacker: RiotTeamId): RiotTeamId {
  if (roundNum < FIRST_HALF_ROUNDS) return firstHalfAttacker;
  if (roundNum < FIRST_HALF_ROUNDS * 2) return otherTeam(firstHalfAttacker);
  const otIndex = roundNum - FIRST_HALF_ROUNDS * 2;
  return otIndex % 2 === 0 ? firstHalfAttacker : otherTeam(firstHalfAttacker);
}

export function attackerTeamForRound(round: RiotRoundResultDto, fallbackFirstHalfAttacker: RiotTeamId): RiotTeamId {
  if (round.winningTeamRole === "Attacker") return round.winningTeam;
  if (round.winningTeamRole === "Defender") return otherTeam(round.winningTeam);
  return heuristicAttackerForRound(round.roundNum, fallbackFirstHalfAttacker);
}

export interface RoundSides {
  atk: RiotTeamId;
  def: RiotTeamId;
}

export function computeRoundSides(rounds: RiotRoundResultDto[], players: RiotMatchPlayerDto[]): Map<number, RoundSides> {
  const fallback = firstHalfAttackerFallback(rounds, players);
  const map = new Map<number, RoundSides>();
  for (const round of rounds) {
    const atk = attackerTeamForRound(round, fallback);
    map.set(round.roundNum, { atk, def: otherTeam(atk) });
  }
  return map;
}

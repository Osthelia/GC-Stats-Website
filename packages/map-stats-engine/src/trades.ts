/**
 * GC-Stats — trades module
 *
 * Detects trade kills: whether a killer was then killed by a teammate of
 * their victim within the trade window.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { normalizeRoundKills } from "./kills";
import type { RiotMatchDto, RiotRoundResultDto, RiotTeamId } from "./types";

export const TRADE_WINDOW_MS = 3000;

export interface RoundTradeInfo {
  /** Victims whose death was avenged by a teammate within the trade window. */
  tradedVictimPuuids: Set<string>;
  /** Killers credited with a trade kill this round (may repeat if they got more than one). */
  tradeKillerPuuids: string[];
}

/** For each kill, was the killer then killed by a teammate of the original victim within TRADE_WINDOW_MS? */
export function computeRoundTrades(round: RiotRoundResultDto, teamByPuuid: Map<string, RiotTeamId>): RoundTradeInfo {
  const kills = normalizeRoundKills(round)
    .filter((k) => k.killerPuuid !== null)
    .sort((a, b) => a.timeSinceRoundStartMillis - b.timeSinceRoundStartMillis);

  const tradedVictimPuuids = new Set<string>();
  const tradeKillerPuuids: string[] = [];

  for (const kill of kills) {
    const victimTeam = teamByPuuid.get(kill.victimPuuid);
    const avenge = kills.find(
      (candidate) =>
        candidate.victimPuuid === kill.killerPuuid &&
        candidate.timeSinceRoundStartMillis >= kill.timeSinceRoundStartMillis &&
        candidate.timeSinceRoundStartMillis - kill.timeSinceRoundStartMillis <= TRADE_WINDOW_MS &&
        teamByPuuid.get(candidate.killerPuuid!) === victimTeam
    );
    if (avenge?.killerPuuid) {
      tradedVictimPuuids.add(kill.victimPuuid);
      tradeKillerPuuids.push(avenge.killerPuuid);
    }
  }

  return { tradedVictimPuuids, tradeKillerPuuids };
}

export function computeTrades(match: RiotMatchDto): { tradeKills: Map<string, number>; tradedDeaths: Map<string, number> } {
  const teamByPuuid = new Map(match.players.map((p) => [p.puuid, p.teamId]));
  const tradeKills = new Map<string, number>();
  const tradedDeaths = new Map<string, number>();

  for (const round of match.roundResults) {
    const { tradedVictimPuuids, tradeKillerPuuids } = computeRoundTrades(round, teamByPuuid);
    for (const victim of tradedVictimPuuids) tradedDeaths.set(victim, (tradedDeaths.get(victim) ?? 0) + 1);
    for (const killer of tradeKillerPuuids) tradeKills.set(killer, (tradeKills.get(killer) ?? 0) + 1);
  }

  return { tradeKills, tradedDeaths };
}

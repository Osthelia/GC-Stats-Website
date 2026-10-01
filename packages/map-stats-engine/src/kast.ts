/**
 * GC-Stats — kast module
 *
 * Computes which players earn KAST credit (Kill, Assist, Traded, or
 * Survived) for a given round.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { normalizeRoundKills } from "./kills";
import { computeRoundTrades } from "./trades";
import type { RiotMatchPlayerDto, RiotRoundResultDto, RiotTeamId } from "./types";

/** Players credited with KAST this round: got a Kill, an Assist, were Traded, or Survived. */
export function computeRoundKastPuuids(round: RiotRoundResultDto, players: RiotMatchPlayerDto[], teamByPuuid: Map<string, RiotTeamId>): Set<string> {
  const kills = normalizeRoundKills(round);
  const killers = new Set(kills.filter((k) => k.killerPuuid).map((k) => k.killerPuuid!));
  const assisters = new Set(kills.flatMap((k) => k.assistantPuuids));
  const victims = new Set(kills.map((k) => k.victimPuuid));
  const { tradedVictimPuuids } = computeRoundTrades(round, teamByPuuid);

  const kast = new Set<string>();
  for (const player of players) {
    if (player.isObserver) continue;
    if (killers.has(player.puuid) || assisters.has(player.puuid) || tradedVictimPuuids.has(player.puuid) || !victims.has(player.puuid)) {
      kast.add(player.puuid);
    }
  }
  return kast;
}

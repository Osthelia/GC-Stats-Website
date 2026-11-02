/**
 * GC-Stats - rating input from a Riot match
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { normalizeRoundKills } from "../kills";
import { extractPlantInfo } from "../plant";
import { computeRoundSides } from "../sides";
import type { RiotMatchDto } from "../types";
import { agentKey, agentRole } from "./agent-roles";
import { ratingKillCause } from "./kill-cause";
import type { RatingMapInput } from "./types";

export function ratingInputFromRiot(match: RiotMatchDto, resolveAgentName: (characterId: string) => string): RatingMapInput {
  const players = match.players.filter((p) => !p.isObserver);
  const sides = computeRoundSides(match.roundResults, match.players);

  return {
    players: players.map((p) => {
      const name = resolveAgentName(p.characterId);
      return {
        id: p.puuid,
        team: p.teamId,
        agent: agentKey(name),
        role: agentRole(name),
      };
    }),
    rounds: match.roundResults.map((round) => {
      const plant = extractPlantInfo(round);
      return {
        roundNum: round.roundNum,
        atkTeam: sides.get(round.roundNum)!.atk,
        winnerTeam: round.winningTeam,
        plantTimeMs: plant.plantTimeMs,
        planter: plant.planterPuuid || null,
        defuser: plant.defuserPuuid || null,
        loadouts: Object.fromEntries(round.playerStats.map((ps) => [ps.puuid, ps.economy?.loadoutValue ?? 0])),
        kills: normalizeRoundKills(round).map((k) => ({
          timeMs: k.timeSinceRoundStartMillis,
          cause: ratingKillCause(k.killerPuuid, k.damageType),
          killer: k.killerPuuid,
          victim: k.victimPuuid,
          assistants: k.assistantPuuids,
        })),
        damages: round.playerStats.flatMap((ps) =>
          ps.damage.map((d) => ({
            attacker: ps.puuid,
            receiver: d.receiver,
            damage: d.damage,
          })),
        ),
      };
    }),
  };
}

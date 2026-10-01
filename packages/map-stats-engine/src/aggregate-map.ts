/**
 * GC-Stats — aggregate-map module
 *
 * Package entry point: computeMapAggregates() combines every other stats
 * module (basic stats, advanced stats, kill breakdown, sides, trades) into
 * the per-player and per-team-round rows persisted for a map. Pure, no I/O.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { computeBasicStats } from "./basic-stats";
import { computeClutches, computeMultikills, computeRoundTypeSplits } from "./advanced-stats";
import { computeKillBreakdown } from "./kill-breakdown";
import { computeRoundSides } from "./sides";
import { computeTrades } from "./trades";
import type { MapAggregates, PlayerAggRow, RiotMatchDto, TeamRoundAggRow } from "./types";

/**
 * Single entry point: everything else in this package is an implementation
 * detail of this function. Pure — no I/O. `resolveWeaponName` is the only
 * injected dependency, letting the caller (apps/web) supply an already-
 * fetched Riot content dictionary without this package knowing that concept
 * exists.
 */
export function computeMapAggregates(match: RiotMatchDto, resolveWeaponName: (damageItemUuid: string) => string): MapAggregates {
  const basicStats = computeBasicStats(match);
  const { tradeKills, tradedDeaths } = computeTrades(match);
  const multikills = computeMultikills(match);
  const clutches = computeClutches(match);
  const killBreakdown = computeKillBreakdown(match.roundResults, resolveWeaponName);
  const sidesByRound = computeRoundSides(match.roundResults, match.players);
  const roundTypeSplits = computeRoundTypeSplits(match, sidesByRound);

  const playerStats: PlayerAggRow[] = match.players
    .filter((p) => !p.isObserver)
    .map((player) => {
      const basic = basicStats.get(player.puuid)!;
      const kb = killBreakdown.get(player.puuid);
      return {
        puuid: player.puuid,
        teamId: player.teamId,
        valName: `${player.gameName}#${player.tagLine}`,
        agentCharacterId: player.characterId,
        kills: basic.kills,
        deaths: basic.deaths,
        assists: basic.assists,
        acs: basic.acs,
        adr: basic.adr,
        kastPercentage: basic.kastPercentage,
        firstKills: basic.firstKills,
        firstDeaths: basic.firstDeaths,
        headshotPercentage: basic.headshotPercentage,
        clutches: clutches.get(player.puuid) ?? {},
        multikills: multikills.get(player.puuid) ?? {},
        tradeKills: tradeKills.get(player.puuid) ?? 0,
        tradedDeaths: tradedDeaths.get(player.puuid) ?? 0,
        roundTypeSplits: roundTypeSplits.get(player.puuid) ?? {},
        abilityKills: kb?.abilityKills ?? { ability1: 0, ability2: 0, grenade: 0, ultimate: 0 },
        fallDeaths: kb?.fallDeaths ?? 0,
        weaponKills: kb?.weaponKills ?? {},
      };
    });

  const teamRoundSummary: TeamRoundAggRow[] = [];
  for (const teamId of ["Red", "Blue"] as const) {
    for (const side of ["atk", "def"] as const) {
      let roundsPlayed = 0;
      let roundsWon = 0;
      for (const round of match.roundResults) {
        const sides = sidesByRound.get(round.roundNum);
        if (!sides) continue;
        const teamSide: "atk" | "def" = sides.atk === teamId ? "atk" : "def";
        if (teamSide !== side) continue;
        roundsPlayed++;
        if (round.winningTeam === teamId) roundsWon++;
      }
      if (roundsPlayed > 0) teamRoundSummary.push({ teamId, side, roundsPlayed, roundsWon });
    }
  }

  return { playerStats, teamRoundSummary };
}

/**
 * GC-Stats — advanced-stats module
 *
 * Derives multikills, clutches, and round-type splits (eco/force/full buy,
 * per side) from a Riot match's round results, for the advanced stats
 * tables shown alongside the basic per-player stats.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { normalizeRoundKills } from "./kills";
import { computeRoundKastPuuids } from "./kast";
import type { RoundSides } from "./sides";
import type { ClutchEntry, RiotMatchDto, RiotRoundResultDto, RiotTeamId, RoundTypeSplitBuy, RoundTypeSplitSide } from "./types";

export const PISTOL_ROUND_NUMBERS = new Set([0, 12]); // 0-indexed rounds 1 and 13
export const TEAM_ECO_MAX_LOADOUT = 5000;
export const TEAM_FORCE_MAX_LOADOUT = 20000;

/** Rounds where a player got 2+ kills, bucketed "2k".."5k" (capped at 5). */
export function computeMultikills(match: RiotMatchDto): Map<string, Record<string, number>> {
  const result = new Map<string, Record<string, number>>();

  for (const round of match.roundResults) {
    const perKiller = new Map<string, number>();
    for (const kill of normalizeRoundKills(round)) {
      if (!kill.killerPuuid) continue;
      perKiller.set(kill.killerPuuid, (perKiller.get(kill.killerPuuid) ?? 0) + 1);
    }
    for (const [puuid, count] of perKiller) {
      if (count < 2) continue;
      const bucket = `${Math.min(count, 5)}k`;
      const row = result.get(puuid) ?? {};
      row[bucket] = (row[bucket] ?? 0) + 1;
      result.set(puuid, row);
    }
  }

  return result;
}

/**
 * A clutch: the round where a team first drops to exactly 1 player alive
 * while the opponent still has at least 1 — attributed to that lone
 * survivor, sized by opponents alive at that moment (capped 1v5). Won if
 * the survivor's team ends up winning the round.
 */
export function computeClutches(match: RiotMatchDto): Map<string, Record<string, ClutchEntry>> {
  const result = new Map<string, Record<string, ClutchEntry>>();
  const teamByPuuid = new Map(match.players.map((p) => [p.puuid, p.teamId as RiotTeamId]));

  for (const round of match.roundResults) {
    const roster: Record<RiotTeamId, Set<string>> = {
      Red: new Set(match.players.filter((p) => p.teamId === "Red" && !p.isObserver).map((p) => p.puuid)),
      Blue: new Set(match.players.filter((p) => p.teamId === "Blue" && !p.isObserver).map((p) => p.puuid)),
    };

    const kills = normalizeRoundKills(round).sort((a, b) => a.timeSinceRoundStartMillis - b.timeSinceRoundStartMillis);
    let clutchCandidate: { puuid: string; team: RiotTeamId; size: number } | null = null;
    const flaggedTeams = new Set<RiotTeamId>();

    for (const kill of kills) {
      const victimTeam = teamByPuuid.get(kill.victimPuuid);
      if (victimTeam) roster[victimTeam].delete(kill.victimPuuid);

      if (clutchCandidate) continue;
      for (const team of ["Red", "Blue"] as const) {
        if (flaggedTeams.has(team)) continue;
        const mine = roster[team].size;
        const opponentTeam = team === "Red" ? "Blue" : "Red";
        const opponents = roster[opponentTeam].size;
        if (mine === 1 && opponents >= 1) {
          const [survivorPuuid] = roster[team];
          if (survivorPuuid) {
            clutchCandidate = { puuid: survivorPuuid, team, size: Math.min(opponents, 5) };
            flaggedTeams.add(team);
          }
        }
      }
    }

    if (clutchCandidate) {
      const won = round.winningTeam === clutchCandidate.team;
      const row = result.get(clutchCandidate.puuid) ?? {};
      const key = `1v${clutchCandidate.size}`;
      const entry = row[key] ?? { won: 0, total: 0 };
      entry.total += 1;
      if (won) entry.won += 1;
      row[key] = entry;
      result.set(clutchCandidate.puuid, row);
    }
  }

  return result;
}

function teamBuyTier(round: RiotRoundResultDto, team: RiotTeamId, teamByPuuid: Map<string, RiotTeamId>): "eco" | "force" | "fullBuy" {
  const total = round.playerStats
    .filter((ps) => teamByPuuid.get(ps.puuid) === team)
    .reduce((sum, ps) => sum + (ps.economy?.loadoutValue ?? 0), 0);
  if (total <= TEAM_ECO_MAX_LOADOUT) return "eco";
  if (total <= TEAM_FORCE_MAX_LOADOUT) return "force";
  return "fullBuy";
}

/** Per-player breakdown by buy type (pistol/eco/force/fullBuy) and by side (atk/def). */
export function computeRoundTypeSplits(match: RiotMatchDto, sidesByRound: Map<number, RoundSides>): Map<string, Record<string, RoundTypeSplitBuy | RoundTypeSplitSide>> {
  const teamByPuuid = new Map(match.players.map((p) => [p.puuid, p.teamId as RiotTeamId]));
  const result = new Map<string, Record<string, RoundTypeSplitBuy | RoundTypeSplitSide>>();

  const ensure = (puuid: string) => {
    let row = result.get(puuid);
    if (!row) {
      row = {};
      result.set(puuid, row);
    }
    return row;
  };

  for (const round of match.roundResults) {
    const sides = sidesByRound.get(round.roundNum);
    if (!sides) continue;

    const kastPuuids = computeRoundKastPuuids(round, match.players, teamByPuuid);
    const killsByPlayer = new Map<string, number>();
    for (const kill of normalizeRoundKills(round)) {
      if (kill.killerPuuid) killsByPlayer.set(kill.killerPuuid, (killsByPlayer.get(kill.killerPuuid) ?? 0) + 1);
    }

    const isPistol = PISTOL_ROUND_NUMBERS.has(round.roundNum);
    const tierByTeam: Partial<Record<RiotTeamId, "eco" | "force" | "fullBuy">> = isPistol
      ? {}
      : { Red: teamBuyTier(round, "Red", teamByPuuid), Blue: teamBuyTier(round, "Blue", teamByPuuid) };

    for (const player of match.players) {
      if (player.isObserver) continue;
      const row = ensure(player.puuid);
      const team = player.teamId;
      const roundWon = round.winningTeam === team;

      const buyKey = isPistol ? "pistol" : tierByTeam[team]!;
      const buyEntry = (row[buyKey] as RoundTypeSplitBuy | undefined) ?? { won: 0, played: 0 };
      buyEntry.played += 1;
      if (roundWon) buyEntry.won += 1;
      row[buyKey] = buyEntry;

      const sideKey = sides.atk === team ? "atk" : "def";
      const sideEntry = (row[sideKey] as RoundTypeSplitSide | undefined) ?? { rounds: 0, roundsWon: 0, kills: 0, kast: 0 };
      sideEntry.rounds += 1;
      if (roundWon) sideEntry.roundsWon += 1;
      sideEntry.kills += killsByPlayer.get(player.puuid) ?? 0;
      if (kastPuuids.has(player.puuid)) sideEntry.kast += 1;
      row[sideKey] = sideEntry;
    }
  }

  return result;
}

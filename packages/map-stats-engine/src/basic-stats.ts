/**
 * GC-Stats — basic-stats module
 *
 * Computes the "basic" per-player stats (kills, deaths, assists, ACS, ADR,
 * KAST%, first kills/deaths, headshot%), mirroring V1's
 * MapStatsCalculator::computeBasicStats.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { normalizeRoundKills } from "./kills";
import { computeRoundKastPuuids } from "./kast";
import type { RiotMatchDto, RiotTeamId } from "./types";

export interface BasicStatsRow {
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  kastPercentage: number;
  firstKills: number;
  firstDeaths: number;
  headshotPercentage: number;
}

/** KAST/ACS/ADR/HS%/first kill-death — the "basic" per-player stats, per V1's MapStatsCalculator::computeBasicStats. */
export function computeBasicStats(match: RiotMatchDto): Map<string, BasicStatsRow> {
  const teamByPuuid = new Map(match.players.map((p) => [p.puuid, p.teamId as RiotTeamId]));
  const result = new Map<string, BasicStatsRow>();
  const totalScore = new Map<string, number>();
  const totalDamage = new Map<string, number>();
  const shotCounts = new Map<string, { hs: number; body: number; leg: number }>();
  const kastRounds = new Map<string, number>();

  for (const player of match.players) {
    if (player.isObserver) continue;
    result.set(player.puuid, {
      kills: player.stats.kills,
      deaths: player.stats.deaths,
      assists: player.stats.assists,
      acs: 0,
      adr: 0,
      kastPercentage: 0,
      firstKills: 0,
      firstDeaths: 0,
      headshotPercentage: 0,
    });
  }

  for (const round of match.roundResults) {
    const kills = normalizeRoundKills(round);

    const withKiller = kills.filter((k) => k.killerPuuid !== null).sort((a, b) => a.timeSinceRoundStartMillis - b.timeSinceRoundStartMillis);
    const first = withKiller[0];
    if (first?.killerPuuid) {
      const killerRow = result.get(first.killerPuuid);
      if (killerRow) killerRow.firstKills++;
      const victimRow = result.get(first.victimPuuid);
      if (victimRow) victimRow.firstDeaths++;
    }

    const kastPuuids = computeRoundKastPuuids(round, match.players, teamByPuuid);
    for (const puuid of kastPuuids) kastRounds.set(puuid, (kastRounds.get(puuid) ?? 0) + 1);

    for (const playerStats of round.playerStats) {
      if (!result.has(playerStats.puuid)) continue;
      totalScore.set(playerStats.puuid, (totalScore.get(playerStats.puuid) ?? 0) + playerStats.score);

      const shots = shotCounts.get(playerStats.puuid) ?? { hs: 0, body: 0, leg: 0 };
      let damage = 0;
      for (const d of playerStats.damage) {
        damage += d.damage;
        shots.hs += d.headshots;
        shots.body += d.bodyshots;
        shots.leg += d.legshots;
      }
      totalDamage.set(playerStats.puuid, (totalDamage.get(playerStats.puuid) ?? 0) + damage);
      shotCounts.set(playerStats.puuid, shots);
    }
  }

  for (const [puuid, row] of result) {
    const player = match.players.find((p) => p.puuid === puuid);
    const roundsPlayed = player?.stats.roundsPlayed || match.roundResults.length || 1;
    row.acs = Math.round((totalScore.get(puuid) ?? 0) / roundsPlayed);
    row.adr = Math.round((totalDamage.get(puuid) ?? 0) / roundsPlayed);
    row.kastPercentage = Number((((kastRounds.get(puuid) ?? 0) / roundsPlayed) * 100).toFixed(2));
    const shots = shotCounts.get(puuid);
    const totalShots = shots ? shots.hs + shots.body + shots.leg : 0;
    row.headshotPercentage = totalShots > 0 ? Number((((shots!.hs) / totalShots) * 100).toFixed(2)) : 0;
  }

  return result;
}

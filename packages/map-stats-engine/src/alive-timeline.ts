/**
 * GC-Stats — alive-timeline module
 *
 * Builds a per-kill-event timeline of players alive on each side for every
 * round, used to render "N v M" round progression displays.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { normalizeRoundKills } from "./kills";
import type { RoundSides } from "./sides";
import type { RiotMatchDto, RiotTeamId } from "./types";

export interface AliveStateRow {
  roundNum: number;
  sequence: number;
  timeMs: number;
  atkAlive: number;
  defAlive: number;
  winnerSide: "atk" | "def";
}

/**
 * One row per kill event in a round (plus a round-start row at sequence 0),
 * tracking how many players are left alive on each side. `winnerSide` is
 * the round's eventual outcome, repeated on every row of that round — feeds
 * "N v M, side won" displays without a join back to the round. Assumes a
 * standard 5-player side (no partial-roster adjustment).
 */
export function computeAliveTimeline(match: RiotMatchDto, sidesByRound: Map<number, RoundSides>): AliveStateRow[] {
  const teamByPuuid = new Map(match.players.map((p) => [p.puuid, p.teamId]));
  const rows: AliveStateRow[] = [];

  for (const round of match.roundResults) {
    const sides = sidesByRound.get(round.roundNum);
    if (!sides) continue;

    const winnerSide: "atk" | "def" = round.winningTeam === sides.atk ? "atk" : "def";
    let atkAlive = 5;
    let defAlive = 5;

    rows.push({ roundNum: round.roundNum, sequence: 0, timeMs: 0, atkAlive, defAlive, winnerSide });

    const kills = normalizeRoundKills(round).sort((a, b) => a.timeSinceRoundStartMillis - b.timeSinceRoundStartMillis);
    let sequence = 1;
    for (const kill of kills) {
      const victimTeam: RiotTeamId | undefined = teamByPuuid.get(kill.victimPuuid);
      if (victimTeam === sides.atk) atkAlive = Math.max(0, atkAlive - 1);
      else if (victimTeam === sides.def) defAlive = Math.max(0, defAlive - 1);
      rows.push({ roundNum: round.roundNum, sequence: sequence++, timeMs: kill.timeSinceRoundStartMillis, atkAlive, defAlive, winnerSide });
    }
  }

  return rows;
}

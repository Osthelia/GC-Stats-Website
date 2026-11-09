/**
 * GC-Stats - rating components
 *
 * Computes, per player and per side, the numerators of the seven rating
 * components (impact, eco-adjusted kills, survival, damage, KAST, weighted
 * assists, opening duels) for one map.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { TRADE_WINDOW_MS } from "../trades";
import type { RiotTeamId } from "../types";
import {
  CLUTCH_BONUS_BY_OPPONENTS,
  DAMAGE_ASSIST_SHARE,
  DAMAGE_ASSIST_WEIGHT,
  ECO_FACTOR_MAX,
  ECO_FACTOR_MIN,
  ECO_LOADOUT_FLOOR,
  MAX_ASSIST_SHARE,
  TRADED_DEATH_FACTOR,
  UTILITY_ASSIST_SHARE,
} from "./constants";
import { atkWinProb, buildRoundTimeline } from "./win-probability";
import { RATING_COMPONENTS, type RatingComponent, type RatingKill, type RatingMapInput, type RatingPlayerRecord, type RatingRound, type RatingSide, type WinProbCounts } from "./types";

function emptySums(): Record<RatingComponent, number> {
  return Object.fromEntries(RATING_COMPONENTS.map((c) => [c, 0])) as Record<RatingComponent, number>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Victims avenged by a teammate of theirs within the trade window. */
function tradedVictims(kills: RatingKill[], teamById: Map<string, RiotTeamId>): Set<RatingKill> {
  const sorted = kills.filter((k) => k.killer !== null).sort((a, b) => a.timeMs - b.timeMs);
  const traded = new Set<RatingKill>();
  for (const kill of sorted) {
    const victimTeam = teamById.get(kill.victim);
    if (teamById.get(kill.killer!) === victimTeam) continue;
    const avenged = sorted.some((c) => c.victim === kill.killer && c.timeMs >= kill.timeMs && c.timeMs - kill.timeMs <= TRADE_WINDOW_MS && c.killer !== null && teamById.get(c.killer) === victimTeam);
    if (avenged) traded.add(kill);
  }
  return traded;
}

export function computeRatingRecords(input: RatingMapInput, winProb: WinProbCounts): RatingPlayerRecord[] {
  const teamById = new Map(input.players.map((p) => [p.id, p.team]));
  const records = new Map<string, RatingPlayerRecord>(
    input.players.map((p) => [
      p.id,
      {
        id: p.id,
        agent: p.agent,
        role: p.role,
        sides: {
          atk: { rounds: 0, sums: emptySums() },
          def: { rounds: 0, sums: emptySums() },
        },
        clutchesWon: 0,
        clutchPoints: 0,
      },
    ]),
  );

  for (const round of input.rounds) accumulateRound(round, input, winProb, teamById, records);
  return [...records.values()];
}

function accumulateRound(round: RatingRound, input: RatingMapInput, winProb: WinProbCounts, teamById: Map<string, RiotTeamId>, records: Map<string, RatingPlayerRecord>): void {
  const sideOf = (id: string): RatingSide => (teamById.get(id) === round.atkTeam ? "atk" : "def");
  const add = (id: string | null, component: RatingComponent, value: number) => {
    if (!id) return;
    const record = records.get(id);
    if (record) record.sides[sideOf(id)].sums[component] += value;
  };

  const timeline = buildRoundTimeline(round, input);
  const pAtk = (state: Parameters<typeof atkWinProb>[1]) => atkWinProb(winProb, state, timeline.econ);
  const traded = tradedVictims(round.kills, teamById);

  const damagedBy = new Map<string, Set<string>>();
  for (const d of round.damages) {
    if (d.damage <= 0 || teamById.get(d.attacker) === teamById.get(d.receiver)) continue;
    const set = damagedBy.get(d.attacker) ?? new Set<string>();
    set.add(d.receiver);
    damagedBy.set(d.attacker, set);
    add(d.attacker, "dmg", d.damage);
  }

  const kastIds = new Set<string>();
  const deathCost = new Map<string, number>();
  let openingDone = false;

  // Clutch: first moment a team is down to one player while the opponent still has someone alive.
  const alive: Record<RiotTeamId, Set<string>> = {
    Red: new Set(input.players.filter((p) => p.team === "Red").map((p) => p.id)),
    Blue: new Set(input.players.filter((p) => p.team === "Blue").map((p) => p.id)),
  };
  const clutches: { team: RiotTeamId; survivor: string; opponents: number }[] = [];

  for (const event of timeline.events) {
    const atkDelta = pAtk(event.after) - pAtk(event.before);

    if (event.type === "plant") {
      if (round.planter && sideOf(round.planter) === "atk") add(round.planter, "imp", atkDelta);
      continue;
    }

    const { kill } = event;
    const victimTeam = teamById.get(kill.victim);
    if (!victimTeam) continue;

    alive[victimTeam].delete(kill.victim);
    for (const team of ["Red", "Blue"] as const) {
      const opponents = alive[team === "Red" ? "Blue" : "Red"].size;
      if (alive[team].size !== 1 || opponents < 1 || clutches.some((c) => c.team === team)) continue;
      clutches.push({ team, survivor: [...alive[team]][0]!, opponents: Math.min(opponents, 5) });
    }

    // Fall, bomb or map damage: often a deliberate death, neither the victim nor anyone else is credited (survival and KAST stay neutral).
    if (kill.cause === "environment") continue;
    const opponentIsAtk = victimTeam !== round.atkTeam;
    // Win probability gained by the victim's opponents.
    const delta = opponentIsAtk ? atkDelta : -atkDelta;
    const isTeamKill = kill.killer !== null && teamById.get(kill.killer) === victimTeam;
    const isTraded = traded.has(kill);
    const victimFactor = isTraded ? TRADED_DEATH_FACTOR : 1;

    deathCost.set(kill.victim, (deathCost.get(kill.victim) ?? 0) + victimFactor);
    if (isTraded) kastIds.add(kill.victim);

    // Same definition as the basic first kill stat: the first kill with a killer, even a teamkill.
    const isOpening = !openingDone && kill.killer !== null;
    if (isOpening) openingDone = true;

    if (kill.cause === "self" || kill.killer === null) {
      add(kill.victim, "imp", -delta);
      continue;
    }
    if (isTeamKill) {
      add(kill.killer, "imp", -delta);
      continue;
    }

    const assistants = kill.assistants.filter((id) => id !== kill.killer && teamById.get(id) !== undefined && teamById.get(id) !== victimTeam);
    const shares = assistants.map((id) => ({
      id,
      utility: !damagedBy.get(id)?.has(kill.victim),
    }));
    const rawShare = shares.reduce((sum, s) => sum + (s.utility ? UTILITY_ASSIST_SHARE : DAMAGE_ASSIST_SHARE), 0);
    const scale = rawShare > MAX_ASSIST_SHARE ? MAX_ASSIST_SHARE / rawShare : 1;
    let assistTotal = 0;
    for (const s of shares) {
      const share = (s.utility ? UTILITY_ASSIST_SHARE : DAMAGE_ASSIST_SHARE) * scale;
      assistTotal += share;
      add(s.id, "imp", share * delta);
      add(s.id, "ast", s.utility ? 1 : DAMAGE_ASSIST_WEIGHT);
      kastIds.add(s.id);
    }
    add(kill.killer, "imp", (1 - assistTotal) * delta);
    add(kill.victim, "imp", -victimFactor * delta);

    const killerLoadout = Math.max(round.loadouts[kill.killer] ?? 0, ECO_LOADOUT_FLOOR);
    const victimLoadout = Math.max(round.loadouts[kill.victim] ?? 0, ECO_LOADOUT_FLOOR);
    add(kill.killer, "kil", clamp(Math.sqrt(victimLoadout / killerLoadout), ECO_FACTOR_MIN, ECO_FACTOR_MAX));
    kastIds.add(kill.killer);

    if (isOpening) {
      add(kill.killer, "opn", 1);
      add(kill.victim, "opn", -victimFactor);
    }
  }

  for (const clutch of clutches) {
    if (clutch.team !== round.winnerTeam) continue;
    const record = records.get(clutch.survivor);
    if (!record) continue;
    record.clutchesWon += 1;
    record.clutchPoints += CLUTCH_BONUS_BY_OPPONENTS[clutch.opponents] ?? 0;
  }

  for (const player of input.players) {
    const record = records.get(player.id)!;
    const side = record.sides[sideOf(player.id)];
    side.rounds += 1;
    const cost = Math.min(1, deathCost.get(player.id) ?? 0);
    side.sums.srv += 1 - cost;
    if (!deathCost.has(player.id)) kastIds.add(player.id);
    if (kastIds.has(player.id)) side.sums.kst += 1;
  }
}

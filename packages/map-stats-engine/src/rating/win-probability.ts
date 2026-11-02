/**
 * GC-Stats - rating win probability
 *
 * Round timeline (alive counts, plant) and the attacker win probability of
 * each state, learned from stored rounds with a backoff smoothing toward
 * coarser states when a state has few visits.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { PISTOL_ROUND_NUMBERS, TEAM_ECO_MAX_LOADOUT, TEAM_FORCE_MAX_LOADOUT } from "../advanced-stats";
import type { RiotTeamId } from "../types";
import { WIN_PROB_ALPHA } from "./constants";
import type { RatingKill, RatingMapInput, RatingRound, WinProbCounts } from "./types";

export type EconBucket = "a" | "e" | "d";

export interface RoundState {
  atk: number;
  def: number;
  planted: boolean;
}

export type TimelineEvent = { type: "plant"; before: RoundState; after: RoundState } | { type: "kill"; kill: RatingKill; before: RoundState; after: RoundState };

export interface RoundTimeline {
  econ: EconBucket;
  start: RoundState;
  events: TimelineEvent[];
  /** State once every event happened, before the round outcome. */
  end: RoundState;
}

function teamTier(round: RatingRound, team: RiotTeamId, teamById: Map<string, RiotTeamId>): number {
  let total = 0;
  for (const [id, value] of Object.entries(round.loadouts)) if (teamById.get(id) === team) total += value;
  if (total <= TEAM_ECO_MAX_LOADOUT) return 0;
  if (total <= TEAM_FORCE_MAX_LOADOUT) return 1;
  return 2;
}

export function econBucket(round: RatingRound, teamById: Map<string, RiotTeamId>): EconBucket {
  if (PISTOL_ROUND_NUMBERS.has(round.roundNum)) return "e";
  const defTeam: RiotTeamId = round.atkTeam === "Red" ? "Blue" : "Red";
  const diff = teamTier(round, round.atkTeam, teamById) - teamTier(round, defTeam, teamById);
  return diff > 0 ? "a" : diff < 0 ? "d" : "e";
}

/** Walks a round in time order. A victim already dead was revived (Sage, Clove), so they are put back before the kill. */
export function buildRoundTimeline(round: RatingRound, input: RatingMapInput): RoundTimeline {
  const teamById = new Map(input.players.map((p) => [p.id, p.team]));
  const alive: Record<RiotTeamId, Set<string>> = {
    Red: new Set(input.players.filter((p) => p.team === "Red").map((p) => p.id)),
    Blue: new Set(input.players.filter((p) => p.team === "Blue").map((p) => p.id)),
  };
  const defTeam: RiotTeamId = round.atkTeam === "Red" ? "Blue" : "Red";
  let planted = false;
  const snapshot = (): RoundState => ({
    atk: alive[round.atkTeam].size,
    def: alive[defTeam].size,
    planted,
  });

  const start = snapshot();
  const events: TimelineEvent[] = [];
  const kills = [...round.kills].sort((a, b) => a.timeMs - b.timeMs);
  let plantPending = round.plantTimeMs != null;

  const pushPlant = () => {
    const before = snapshot();
    planted = true;
    plantPending = false;
    events.push({ type: "plant", before, after: snapshot() });
  };

  for (const kill of kills) {
    if (plantPending && round.plantTimeMs! < kill.timeMs) pushPlant();
    const victimTeam = teamById.get(kill.victim);
    if (!victimTeam) continue;
    alive[victimTeam].add(kill.victim);
    const before = snapshot();
    alive[victimTeam].delete(kill.victim);
    events.push({ type: "kill", kill, before, after: snapshot() });
  }
  if (plantPending) pushPlant();

  return { econ: econBucket(round, teamById), start, events, end: snapshot() };
}

/** Fixed outcome when the state already decides the round, null otherwise. */
export function terminalAtkWinProb(state: RoundState): number | null {
  if (state.def === 0) return 1;
  // Attackers wiped after the plant count as lost: the defuse itself carries no value.
  if (state.atk === 0) return 0;
  return null;
}

function stateKeys(state: RoundState, econ: EconBucket): [string, string, string, string] {
  const p = state.planted ? 1 : 0;
  return [`p${p}`, `d${state.atk - state.def}p${p}`, `${state.atk}${state.def}${p}`, `${state.atk}${state.def}${p}${econ}`];
}

/** Counts every non-terminal state visited by every round, at every smoothing level. */
export function accumulateWinProb(counts: WinProbCounts, input: RatingMapInput): void {
  for (const round of input.rounds) {
    const timeline = buildRoundTimeline(round, input);
    const atkWon = round.winnerTeam === round.atkTeam ? 1 : 0;
    const visited = new Set<string>();
    for (const state of [timeline.start, ...timeline.events.map((e) => e.after)]) {
      if (terminalAtkWinProb(state) !== null) continue;
      for (const key of stateKeys(state, timeline.econ)) visited.add(key);
    }
    for (const key of visited) {
      const entry = counts[key] ?? [0, 0];
      entry[0] += 1;
      entry[1] += atkWon;
      counts[key] = entry;
    }
  }
}

export function atkWinProb(counts: WinProbCounts, state: RoundState, econ: EconBucket): number {
  const terminal = terminalAtkWinProb(state);
  if (terminal !== null) return terminal;
  let p = 0.5;
  for (const key of stateKeys(state, econ)) {
    const [visits, wins] = counts[key] ?? [0, 0];
    p = (wins + WIN_PROB_ALPHA * p) / (visits + WIN_PROB_ALPHA);
  }
  return p;
}

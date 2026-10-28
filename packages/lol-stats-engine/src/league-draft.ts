/**
 * GC-Stats — league-draft module
 *
 * The standard tournament draft of a League game: the 20 steps in order, how Riot's ban turns map onto them,
 * and the checks an admin's draft must pass. No database access, so the rules can be tested on their own.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { otherSide, type LeagueSide } from "./game-summary";

export type DraftType = "ban" | "pick";
export type DraftPhase = "ban1" | "pick1" | "ban2" | "pick2";

/** Which side a step belongs to, counted from the side with the first pick: "first" is that side, "second" the other one. */
export type DraftTurn = "first" | "second";

export interface DraftStep {
  /** 1–20, the order of the draft. */
  step: number;
  phase: DraftPhase;
  type: DraftType;
  turn: DraftTurn;
}

/** The standard tournament draft, from the side with the first ban and the first pick: bans 1–6, picks 1–6, bans 7–10, picks 7–10. */
const DRAFT_PHASES: [DraftPhase, DraftType, DraftTurn[]][] = [
  ["ban1", "ban", ["first", "second", "first", "second", "first", "second"]],
  ["pick1", "pick", ["first", "second", "second", "first", "first", "second"]],
  ["ban2", "ban", ["second", "first", "second", "first"]],
  ["pick2", "pick", ["second", "first", "first", "second"]],
];

export const LEAGUE_DRAFT_STEPS: readonly DraftStep[] = DRAFT_PHASES
  .flatMap(([phase, type, turns]) => turns.map((turn) => ({ phase, type, turn })))
  .map((s, i) => ({ ...s, step: i + 1 }));

export function draftStep(step: number): DraftStep | null {
  return LEAGUE_DRAFT_STEPS.find((s) => s.step === step) ?? null;
}

/**
 * Riot numbers the ten bans in draft order (pickTurn 1–10). The first six are steps 1–6 already; the last four
 * come after the picks of phase 1, so they are steps 13–16.
 */
export function banStepForPickTurn(pickTurn: number): number {
  if (!Number.isInteger(pickTurn) || pickTurn < 1 || pickTurn > 10) throw new Error(`Not a ban turn: ${pickTurn}`);
  return pickTurn <= 6 ? pickTurn : pickTurn + 6;
}

/** Gives back the side of the current step */
export function stepSide(step: DraftStep, firstPick: LeagueSide): LeagueSide {
  return step.turn === "first" ? firstPick : otherSide(firstPick);
}

export interface DraftEntry {
  step: number;
  championName: string;
}

export type DraftProblem =
  | { kind: "invalidStep"; step: number }
  | { kind: "unknownChampion"; championName: string }
  | { kind: "duplicateChampion"; championName: string };

/**
 * Check for Duplicate Champions and steps. Also for steps that do not exist.
 */
export function draftProblem(input: { steps: DraftEntry[]; unplacedPicks: string[]; knownChampions: ReadonlySet<string> }): DraftProblem | null {
  const used = new Set<string>();
  const names = [...input.steps.map((entry) => entry.championName), ...input.unplacedPicks];
  const seenSteps = new Set<number>();
  for (const entry of input.steps) {
    if (draftStep(entry.step) === null || seenSteps.has(entry.step)) return { kind: "invalidStep", step: entry.step };
    seenSteps.add(entry.step);
  }
  for (const championName of names) {
    if (!input.knownChampions.has(championName)) return { kind: "unknownChampion", championName };
    if (used.has(championName)) return { kind: "duplicateChampion", championName };
    used.add(championName);
  }
  return null;
}

/** One ban or pick of a draft, without its step: what the import can compare. */
export interface DraftPick {
  side: LeagueSide;
  type: DraftType;
  championName: string;
}

/**
 * Whether the imported draft and the saved one name different champions for the same side and kind. The order is
 * ignored: an admin may move a ban or assign a pick to another step without changing what was drafted.
 */
export function draftDiffers(imported: DraftPick[], saved: DraftPick[]): boolean {
  const keys = (picks: DraftPick[]) => picks.map((p) => `${p.side}|${p.type}|${p.championName}`).sort();
  const a = keys(imported);
  const b = keys(saved);
  return a.length !== b.length || a.some((key, i) => key !== b[i]);
}

/**
 * GC-Stats - veto-engine
 *
 * Pure veto rules: the step sequence of a match format and the state derived
 * from the vetos already recorded. No database access here.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type VetoSide = "atk" | "def";
export type VetoActor = "first" | "second";

export type VetoStep =
  | { kind: "ban"; actor: VetoActor }
  | { kind: "pick"; actor: VetoActor }
  | { kind: "side"; actor: VetoActor; mapIndex: number };

/** One recorded veto row, in order. A decider has `type: "decider"`. */
export type VetoRecord = {
  entrantId: number;
  mapName: string;
  type: "ban" | "pick" | "decider";
  side: VetoSide | null;
  sidePickedByEntrantId: number | null;
};

const BAN_F: VetoStep = { kind: "ban", actor: "first" };
const BAN_S: VetoStep = { kind: "ban", actor: "second" };

/** Extra seconds on top of every action timeout, so polling latency does not eat the team's time. */
export const VETO_GRACE_SECONDS = 3;

/** Steps asked to the teams. The decider is added automatically, only its side is a step. */
export function buildVetoSteps(bestOf: number): VetoStep[] {
  if (bestOf <= 1) {
    return [BAN_F, BAN_S, BAN_F, BAN_S, BAN_F, BAN_S, { kind: "side", actor: "first", mapIndex: 0 }];
  }
  if (bestOf === 3) {
    return [
      BAN_F,
      BAN_S,
      { kind: "pick", actor: "first" },
      { kind: "side", actor: "second", mapIndex: 0 },
      { kind: "pick", actor: "second" },
      { kind: "side", actor: "first", mapIndex: 1 },
      BAN_F,
      BAN_S,
      { kind: "side", actor: "first", mapIndex: 2 },
    ];
  }
  return [
    BAN_F,
    BAN_S,
    { kind: "pick", actor: "first" },
    { kind: "side", actor: "second", mapIndex: 0 },
    { kind: "pick", actor: "second" },
    { kind: "side", actor: "first", mapIndex: 1 },
    { kind: "pick", actor: "first" },
    { kind: "side", actor: "second", mapIndex: 2 },
    { kind: "pick", actor: "second" },
    { kind: "side", actor: "first", mapIndex: 3 },
    { kind: "side", actor: "first", mapIndex: 4 },
  ];
}

/** Maps a pool must hold: every ban and pick, plus the decider left over. */
export function requiredPoolSize(bestOf: number): number {
  return buildVetoSteps(bestOf).filter((s) => s.kind !== "side").length + 1;
}

export type VetoProgress = {
  /** Index in `buildVetoSteps` of the step waiting for an action, null when everything is done. */
  stepIndex: number | null;
  step: VetoStep | null;
  /** Maps still available for a ban or a pick. */
  remainingMaps: string[];
  /** Decider to append to the records now (only one map left and every ban/pick done). */
  deciderToAdd: string | null;
};

/**
 * Walks the steps against the recorded rows. Played maps (picks then decider)
 * are the "map indexes" the side steps point to.
 */
export function computeVetoProgress(bestOf: number, pool: string[], records: VetoRecord[]): VetoProgress {
  const steps = buildVetoSteps(bestOf);
  const used = new Set(records.map((r) => r.mapName));
  const remainingMaps = pool.filter((m) => !used.has(m));
  const played = records.filter((r) => r.type !== "ban");
  const mapActionsDone = records.filter((r) => r.type !== "decider").length;
  const mapActionsTotal = steps.filter((s) => s.kind !== "side").length;

  let seen = 0;
  for (const [index, step] of steps.entries()) {
    if (step.kind === "side") {
      if (played[step.mapIndex]?.side) continue;
    } else if (seen < mapActionsDone) {
      seen++;
      continue;
    }
    const needsDecider = mapActionsDone === mapActionsTotal && !records.some((r) => r.type === "decider");
    return { stepIndex: index, step, remainingMaps, deciderToAdd: needsDecider ? (remainingMaps[0] ?? null) : null };
  }
  return { stepIndex: null, step: null, remainingMaps, deciderToAdd: null };
}

export type VetoActionInput = { kind: "ban" | "pick"; mapName: string } | { kind: "side"; side: VetoSide };

export type VetoActionError = "wrongStep" | "mapUnavailable" | "invalidSide" | "noStep";

/** Checks that an action fits the waiting step. */
export function validateVetoAction(progress: VetoProgress, action: VetoActionInput): VetoActionError | null {
  const step = progress.step;
  if (!step) return "noStep";
  if (action.kind !== step.kind) return "wrongStep";
  if (action.kind === "side") return action.side === "atk" || action.side === "def" ? null : "invalidSide";
  return progress.remainingMaps.includes(action.mapName) ? null : "mapUnavailable";
}

/** Team that has to act on the step, given who vetoes first. */
export function stepEntrantId(step: VetoStep, firstEntrantId: number, secondEntrantId: number): number {
  return step.actor === "first" ? firstEntrantId : secondEntrantId;
}

/**
 * GC-Stats - rating model
 *
 * Builds the agent/role/global baselines and the calibration of the GCS
 * rating from every player-map record, and rates one record against it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { AGENT_SHRINK_ROUNDS, CLUTCH_REFERENCE_ROUNDS, FALLBACK_WEIGHTS, RATING_FORMULA_VERSION, RATING_TARGET_SD, RATING_Z_CLAMP, ROLE_SHRINK_ROUNDS, ROLE_WEIGHTS, SD_MIN_ROUNDS } from "./constants";
import { computeRatingRecords } from "./components";
import {
  RATING_COMPONENTS,
  type RatingMapInput,
  type AgentRole,
  type BaselineStat,
  type RatingBaselines,
  type RatingComponent,
  type RatingModel,
  type RatingPlayerRecord,
  type RatingResult,
  type RatingSide,
  type WinProbCounts,
} from "./types";

const SIDES: RatingSide[] = ["atk", "def"];

type ComponentValues = Record<RatingComponent, number>;

function zeros(): ComponentValues {
  return Object.fromEntries(RATING_COMPONENTS.map((c) => [c, 0])) as ComponentValues;
}

function totalRounds(record: RatingPlayerRecord): number {
  return record.sides.atk.rounds + record.sides.def.rounds;
}

/** Per-round value of each component over both sides. */
function recordValues(record: RatingPlayerRecord): ComponentValues {
  const rounds = totalRounds(record);
  const values = zeros();
  for (const c of RATING_COMPONENTS) values[c] = rounds > 0 ? (record.sides.atk.sums[c] + record.sides.def.sums[c]) / rounds : 0;
  return values;
}

/** Expected value for this record: side means mixed by the rounds actually played on each side. */
function expectedValues(record: RatingPlayerRecord, stat: BaselineStat): ComponentValues {
  const rounds = totalRounds(record);
  const values = zeros();
  if (rounds === 0) return values;
  for (const c of RATING_COMPONENTS) values[c] = (record.sides.atk.rounds * stat.mean.atk[c] + record.sides.def.rounds * stat.mean.def[c]) / rounds;
  return values;
}

function computeStat(records: RatingPlayerRecord[]): BaselineStat {
  const rounds = { atk: 0, def: 0 };
  const sums = { atk: zeros(), def: zeros() };
  for (const r of records) {
    for (const side of SIDES) {
      rounds[side] += r.sides[side].rounds;
      for (const c of RATING_COMPONENTS) sums[side][c] += r.sides[side].sums[c];
    }
  }
  const mean = { atk: zeros(), def: zeros() };
  for (const side of SIDES) for (const c of RATING_COMPONENTS) mean[side][c] = rounds[side] > 0 ? sums[side][c] / rounds[side] : 0;

  const stat: BaselineStat = {
    rounds: rounds.atk + rounds.def,
    maps: 0,
    mean,
    sd: zeros(),
  };
  const squares = zeros();
  for (const r of records) {
    if (totalRounds(r) < SD_MIN_ROUNDS) continue;
    stat.maps += 1;
    const values = recordValues(r);
    const expected = expectedValues(r, stat);
    for (const c of RATING_COMPONENTS) squares[c] += (values[c] - expected[c]) ** 2;
  }
  for (const c of RATING_COMPONENTS) stat.sd[c] = stat.maps > 1 ? Math.sqrt(squares[c] / (stat.maps - 1)) : 0;
  return stat;
}

/** Pulls a sparse baseline toward its parent, `strength` rounds worth of parent. */
function shrink(child: BaselineStat, parent: BaselineStat, strength: number): BaselineStat {
  const n = child.rounds;
  const blend = (a: number, b: number) => (n * a + strength * b) / (n + strength);
  const mean = { atk: zeros(), def: zeros() };
  const sd = zeros();
  for (const c of RATING_COMPONENTS) {
    for (const side of SIDES) mean[side][c] = blend(child.mean[side][c], parent.mean[side][c]);
    sd[c] = child.maps > 1 ? blend(child.sd[c], parent.sd[c]) : parent.sd[c];
  }
  return { rounds: n, maps: child.maps, mean, sd };
}

function groupBy<K extends string>(records: RatingPlayerRecord[], key: (r: RatingPlayerRecord) => K | null): Map<K, RatingPlayerRecord[]> {
  const groups = new Map<K, RatingPlayerRecord[]>();
  for (const r of records) {
    const k = key(r);
    if (k === null) continue;
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }
  return groups;
}

export function buildBaselines(records: RatingPlayerRecord[]): RatingBaselines {
  const baselines: RatingBaselines = {
    global: computeStat(records),
    role: {},
    agent: {},
  };
  for (const [role, list] of groupBy(records, (r) => r.role)) baselines.role[role] = computeStat(list);
  for (const [agent, list] of groupBy(records, (r) => r.agent)) baselines.agent[agent] = computeStat(list);
  return baselines;
}

/** Agent baseline shrunk to its role, itself shrunk to the global one. */
function expectedStat(record: RatingPlayerRecord, baselines: RatingBaselines): BaselineStat {
  const roleRaw = record.role ? baselines.role[record.role] : undefined;
  const roleStat = roleRaw ? shrink(roleRaw, baselines.global, ROLE_SHRINK_ROUNDS) : baselines.global;
  const agentRaw = record.agent ? baselines.agent[record.agent] : undefined;
  return agentRaw ? shrink(agentRaw, roleStat, AGENT_SHRINK_ROUNDS) : roleStat;
}

function weightsFor(role: AgentRole | null): ComponentValues {
  return role ? ROLE_WEIGHTS[role] : FALLBACK_WEIGHTS;
}

function scoreRecord(record: RatingPlayerRecord, baselines: RatingBaselines): { s: number; components: RatingResult["components"] } {
  const stat = expectedStat(record, baselines);
  const values = recordValues(record);
  const expected = expectedValues(record, stat);
  const weights = weightsFor(record.role);
  const components = {} as RatingResult["components"];
  let s = 0;
  for (const c of RATING_COMPONENTS) {
    const sd = stat.sd[c];
    const z = sd > 0 ? Math.min(RATING_Z_CLAMP, Math.max(-RATING_Z_CLAMP, (values[c] - expected[c]) / sd)) : 0;
    components[c] = { value: values[c], z };
    s += weights[c] * z;
  }
  return { s, components };
}

/** Baselines plus calibration: k sets the SD of per-map ratings to RATING_TARGET_SD. */
export function buildRatingModel(winProb: WinProbCounts, records: RatingPlayerRecord[]): RatingModel {
  const baselines = buildBaselines(records);
  const scores = records.filter((r) => totalRounds(r) >= SD_MIN_ROUNDS).map((r) => scoreRecord(r, baselines).s);
  const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, scores.length - 1);
  const k = variance > 0 ? RATING_TARGET_SD / Math.sqrt(variance) : 1;
  return { formulaVersion: RATING_FORMULA_VERSION, winProb, baselines, k };
}

export function rateRecord(record: RatingPlayerRecord, model: RatingModel): RatingResult | null {
  const rounds = totalRounds(record);
  if (rounds === 0) return null;
  const { s, components } = scoreRecord(record, model.baselines);
  const clutchBonus = record.clutchPoints * (CLUTCH_REFERENCE_ROUNDS / rounds);
  return {
    id: record.id,
    rating: Math.max(0, 1 + model.k * s + clutchBonus),
    rounds,
    components,
    clutch: { won: record.clutchesWon, bonus: clutchBonus },
  };
}

/** Rates every player of one map with an existing model. */
export function rateMap(input: RatingMapInput, model: RatingModel): RatingResult[] {
  return computeRatingRecords(input, model.winProb)
    .map((record) => rateRecord(record, model))
    .filter((r): r is RatingResult => r !== null);
}

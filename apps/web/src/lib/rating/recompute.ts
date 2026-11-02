/**
 * GC-Stats - rating recompute
 *
 * Full recompute of the GCS rating: learns a new model from every map with
 * RAW data, activates it and rewrites every map player rating with it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, isNotNull, ne, or, isNull, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { mapPlayerStats, ratingModels } from "@gc-stats/db";
import {
  accumulateWinProb,
  buildRatingModel,
  computeRatingRecords,
  rateRecord,
  RATING_FORMULA_VERSION,
  type RatingPlayerRecord,
  type RatingResult,
  type RiotTeamId,
  type WinProbCounts,
} from "@gc-stats/map-stats-engine";
import { RATING_LOCK_KEY } from "./active-model";
import { storedRatingDetails } from "./stored-details";
import { listRatableMapIds, loadRawRatingMaps, type RawRatingMap } from "./raw-input";

const LOAD_BATCH_MAPS = 100;
const WRITE_BATCH_ROWS = 500;

interface GroupFigures {
  players: number;
  mean: number;
  sd: number;
}

export interface RatingRecomputeReport {
  maps: number;
  ratedPlayers: number;
  k: number;
  byRole: Record<string, GroupFigures>;
  byAgent: Record<string, GroupFigures>;
  /** Share of maps won by the team with the higher average rating. */
  winnerAgreement: number;
  /** Rating percentiles over every rated player-map. */
  percentiles: Record<string, number>;
  /** Maps won by STOMP_ROUND_DIFF rounds or more: average best and worst rating of the map. */
  stomps: { maps: number; avgBest: number; avgWorst: number };
  /** Clutch bonus: share of player-maps with one, its mean among them and the largest. */
  clutchBonus: { share: number; mean: number; max: number };
  modelId: number | null;
}

interface MapDigest {
  records: RatingPlayerRecord[];
  teamById: Map<string, RiotTeamId>;
  statRowIdByPlayer: Map<string, number>;
  roundsWon: Record<RiotTeamId, number>;
}

/** What the report and the write phase need from a map once its records are built. */
function digestMap(map: RawRatingMap, records: RatingPlayerRecord[]): MapDigest {
  const roundsWon = { Red: 0, Blue: 0 };
  for (const round of map.input.rounds) roundsWon[round.winnerTeam] += 1;
  return { records, teamById: new Map(map.input.players.map((p) => [p.id, p.team])), statRowIdByPlayer: map.statRowIdByPlayer, roundsWon };
}

const STOMP_ROUND_DIFF = 8;
const REPORT_PERCENTILES = [1, 5, 25, 50, 75, 95, 99];

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function percentiles(values: number[]): Record<string, number> {
  const sorted = [...values].sort((a, b) => a - b);
  return Object.fromEntries(REPORT_PERCENTILES.map((p) => [`p${p}`, round3(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0)]));
}

function figures(values: number[]): GroupFigures {
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, values.length - 1);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { players: values.length, mean: round(mean), sd: round(Math.sqrt(variance)) };
}

function groupFigures(rated: { key: string; rating: number }[]): Record<string, GroupFigures> {
  const groups = new Map<string, number[]>();
  for (const r of rated) groups.set(r.key, [...(groups.get(r.key) ?? []), r.rating]);
  return Object.fromEntries([...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([key, values]) => [key, figures(values)]));
}

export async function recomputeAllRatings({ dryRun, log }: { dryRun: boolean; log: (line: string) => void }): Promise<RatingRecomputeReport> {
  const mapIds = await listRatableMapIds();
  log(`maps with RAW data: ${mapIds.length}`);

  // Pass 1 learns the win probability table, pass 2 reloads each batch to build the records: the RAW input of all maps is never held at once.
  const winProb: WinProbCounts = {};
  for (let i = 0; i < mapIds.length; i += LOAD_BATCH_MAPS) {
    const batch = await loadRawRatingMaps(mapIds.slice(i, i + LOAD_BATCH_MAPS));
    for (const map of batch) accumulateWinProb(winProb, map.input);
    log(`counted ${Math.min(i + LOAD_BATCH_MAPS, mapIds.length)}/${mapIds.length}`);
  }

  const digests: MapDigest[] = [];
  for (let i = 0; i < mapIds.length; i += LOAD_BATCH_MAPS) {
    const batch = await loadRawRatingMaps(mapIds.slice(i, i + LOAD_BATCH_MAPS));
    for (const map of batch) digests.push(digestMap(map, computeRatingRecords(map.input, winProb)));
    log(`loaded ${Math.min(i + LOAD_BATCH_MAPS, mapIds.length)}/${mapIds.length}`);
  }

  const allRecords: RatingPlayerRecord[] = digests.flatMap((d) => d.records);
  const model = buildRatingModel(winProb, allRecords);
  log(`model built, k = ${model.k.toFixed(4)}`);

  const rows: { statRowId: number; result: RatingResult }[] = [];
  const rated: { role: string; agent: string; rating: number }[] = [];
  const clutchBonuses: number[] = [];
  let agreeing = 0;
  let decided = 0;
  const stompBest: number[] = [];
  const stompWorst: number[] = [];
  for (const { records, teamById, statRowIdByPlayer, roundsWon } of digests) {
    const teamRatings: Record<string, number[]> = { Red: [], Blue: [] };
    for (const record of records) {
      const result = rateRecord(record, model);
      const statRowId = statRowIdByPlayer.get(record.id);
      if (!result || statRowId === undefined) continue;
      rows.push({ statRowId, result });
      if (result.clutch.bonus > 0) clutchBonuses.push(result.clutch.bonus);
      rated.push({ role: record.role ?? "unknown", agent: record.agent ?? "unknown", rating: result.rating });
      teamRatings[teamById.get(record.id)!]!.push(result.rating);
    }
    if (roundsWon.Red === roundsWon.Blue || !teamRatings.Red!.length || !teamRatings.Blue!.length) continue;
    const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    if (Math.abs(roundsWon.Red - roundsWon.Blue) >= STOMP_ROUND_DIFF) {
      const all = [...teamRatings.Red!, ...teamRatings.Blue!];
      stompBest.push(Math.max(...all));
      stompWorst.push(Math.min(...all));
    }
    decided += 1;
    if (avg(teamRatings.Red!) > avg(teamRatings.Blue!) === roundsWon.Red > roundsWon.Blue) agreeing += 1;
  }

  const report: RatingRecomputeReport = {
    maps: digests.length,
    ratedPlayers: rows.length,
    k: model.k,
    byRole: groupFigures(rated.map((r) => ({ key: r.role, rating: r.rating }))),
    byAgent: groupFigures(rated.map((r) => ({ key: r.agent, rating: r.rating }))),
    winnerAgreement: decided ? round3(agreeing / decided) : 0,
    percentiles: percentiles(rated.map((r) => r.rating)),
    stomps: {
      maps: stompBest.length,
      avgBest: round3(stompBest.reduce((a, b) => a + b, 0) / (stompBest.length || 1)),
      avgWorst: round3(stompWorst.reduce((a, b) => a + b, 0) / (stompWorst.length || 1)),
    },
    clutchBonus: {
      share: round3(clutchBonuses.length / (rows.length || 1)),
      mean: round3(clutchBonuses.reduce((a, b) => a + b, 0) / (clutchBonuses.length || 1)),
      max: round3(Math.max(0, ...clutchBonuses)),
    },
    modelId: null,
  };
  if (dryRun) return report;

  report.modelId = await db.transaction(async (tx) => {
    // Waits for in-flight ingestions and holds new ones back until the new model is active.
    await tx.execute(sql`select pg_advisory_xact_lock(${RATING_LOCK_KEY[0]}, ${RATING_LOCK_KEY[1]})`);

    const [inserted] = await tx
      .insert(ratingModels)
      .values({ formulaVersion: RATING_FORMULA_VERSION, model, report: { ...report, byAgent: undefined }, sampleMaps: digests.length, isActive: false })
      .returning({ id: ratingModels.id });
    const modelId = inserted!.id;

    await writeRows(tx, modelId, rows, log);

    // Maps stored (or fetched again) while the model was computed: rate them with the new model.
    const known = new Set(mapIds);
    const staleRows = await tx
      .selectDistinct({ mapId: mapPlayerStats.mapId })
      .from(mapPlayerStats)
      .where(and(isNotNull(mapPlayerStats.rating), or(isNull(mapPlayerStats.ratingModelId), ne(mapPlayerStats.ratingModelId, modelId))));
    const lateIds = [...new Set([...(await listRatableMapIds()).filter((id) => !known.has(id)), ...staleRows.map((r) => r.mapId)])];
    const lateRows: { statRowId: number; result: RatingResult }[] = [];
    for (let i = 0; i < lateIds.length; i += LOAD_BATCH_MAPS) {
      for (const map of await loadRawRatingMaps(lateIds.slice(i, i + LOAD_BATCH_MAPS))) {
        for (const record of computeRatingRecords(map.input, winProb)) {
          const result = rateRecord(record, model);
          const statRowId = map.statRowIdByPlayer.get(record.id);
          if (result && statRowId !== undefined) lateRows.push({ statRowId, result });
        }
      }
    }
    await writeRows(tx, modelId, lateRows, log);
    if (lateIds.length) log(`rated ${lateIds.length} maps stored during the recompute`);

    // Rows the new model could not rate must not keep a rating from an older model.
    await tx
      .update(mapPlayerStats)
      .set({ rating: null, ratingRounds: null, ratingComponents: null, ratingModelId: null })
      .where(and(isNotNull(mapPlayerStats.rating), or(isNull(mapPlayerStats.ratingModelId), ne(mapPlayerStats.ratingModelId, modelId))));

    await tx.update(ratingModels).set({ isActive: false }).where(eq(ratingModels.isActive, true));
    await tx.update(ratingModels).set({ isActive: true }).where(eq(ratingModels.id, modelId));
    return modelId;
  });

  return report;
}

type RecomputeTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeRows(tx: RecomputeTx, modelId: number, rows: { statRowId: number; result: RatingResult }[], log: (line: string) => void): Promise<void> {
  for (let i = 0; i < rows.length; i += WRITE_BATCH_ROWS) {
    const values = rows
      .slice(i, i + WRITE_BATCH_ROWS)
      .map(({ statRowId, result }) => sql`(${statRowId}::bigint, ${result.rating}::real, ${result.rounds}::int, ${JSON.stringify(storedRatingDetails(result))}::jsonb)`);
    await tx.execute(sql`
      update ${mapPlayerStats} as m
      set rating = v.rating, rating_rounds = v.rounds, rating_components = v.components, rating_model_id = ${modelId}
      from (values ${sql.join(values, sql`, `)}) as v(id, rating, rounds, components)
      where m.id = v.id
    `);
    log(`written ${Math.min(i + WRITE_BATCH_ROWS, rows.length)}/${rows.length}`);
  }
}

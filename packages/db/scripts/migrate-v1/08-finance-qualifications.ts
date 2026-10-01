/**
 * GC-Stats — 08-finance-qualifications
 *
 * V1 to V2 migration step: migrates finance entries and stage qualification
 * results. Only team-kind qualification results are migrated; player-kind
 * rows don't represent a real tournament advancement and are skipped.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db, v1 } from "./connection";
import { getMappedId, setMappedId, batchInsert, preloadEntityType } from "./id-map";
import { financeEntries, stageQualifications, qualificationResults, pointEntries } from "../../src/schema";

export async function migrateFinance() {
  const [rows] = await v1.query<any[]>(
    "SELECT id, entry_date, type, category, label, description, amount_usd, amount_eur, source_url FROM finance_entries"
  );
  const { created, skipped } = await batchInsert(
    "finance_entry",
    rows as any[],
    (row) => row.id,
    (row) => ({
      entryDate: row.entry_date, type: row.type, category: row.category, label: row.label,
      description: row.description, amountUsd: row.amount_usd, amountEur: row.amount_eur, sourceUrl: row.source_url,
    }),
    (tx, values) => tx.insert(financeEntries).values(values as any).returning({ id: financeEntries.id }),
  );
  console.log(`finance_entries: ${created} created, ${skipped} already migrated`);
}

// entrants aren't keyed by their own legacy id — see 05's ENTRANT_KEY_MULTIPLIER.
const ENTRANT_KEY_MULTIPLIER = 10_000_000;
const entrantKey = (tournamentId: number, teamId: number) => tournamentId * ENTRANT_KEY_MULTIPLIER + teamId;

// destination_type 'phase'->'container' (V2 has no separate 'placement'-only
// phase concept — see migrateStages' flattening note). Every V1
// phase_qualification_result with entity_type='player' (406/476 rows) is
// skipped: it doesn't represent a team qualifying (GC-Stats entrants are
// always kind='team', see DATABASES.MD §2.3) — sampled rows turned out to be
// individual per-phase standings unrelated to tournament advancement, with
// no clean entrant to attach to. Only entity_type='team' (70 rows) migrates.
export async function migrateQualifications() {
  await preloadEntityType("phase_as_container");
  await preloadEntityType("match");

  const [phaseRows] = await v1.query<any[]>(
    `SELECT id, source_phase_id, rank_from, rank_to, source_match_id, outcome, destination_type,
            destination_phase_id, placement, placement_label, points, cash_prize_amount, cash_prize_currency
     FROM phase_qualifications`
  );
  let qCreated = 0, qSkipped = 0, qUnresolved = 0;
  for (const row of phaseRows as any[]) {
    if (await getMappedId("phase_qualification", row.id)) { qSkipped++; continue; }
    // V2's stage_qualifications_source_check wants EXACTLY one of
    // sourceContainerId/sourceMatchId. V1's source_phase_id is NOT NULL on
    // every row (it's just "which phase this qualification belongs to"),
    // while source_match_id is the nullable, more specific override — when
    // both are present in V1, the match is the real source, not the phase.
    const sourceMatchId = row.source_match_id ? (await getMappedId("match", row.source_match_id)) ?? null : null;
    const sourceContainerId = sourceMatchId ? null : (await getMappedId("phase_as_container", row.source_phase_id)) ?? null;
    if (!sourceContainerId && !sourceMatchId) { qUnresolved++; continue; }
    const destinationContainerId = row.destination_phase_id ? (await getMappedId("phase_as_container", row.destination_phase_id)) ?? null : null;
    try {
      const [inserted] = await db.insert(stageQualifications).values({
        sourceContainerId, rankFrom: row.rank_from, rankTo: row.rank_to, sourceMatchId, outcome: row.outcome,
        destinationType: row.destination_type === "placement" ? "placement" : "container",
        destinationContainerId, placement: row.placement, placementLabel: row.placement_label,
        points: row.points, cashPrizeAmount: row.cash_prize_amount, cashPrizeCurrency: row.cash_prize_currency,
      }).returning({ id: stageQualifications.id });
      await setMappedId("phase_qualification", row.id, inserted.id);
      qCreated++;
    } catch (e: any) {
      qUnresolved++;
      console.warn(`phase_qualification#${row.id}: ${e.cause?.message ?? e.message}`);
    }
  }
  console.log(`stage_qualifications: ${qCreated} created, ${qSkipped} already migrated, ${qUnresolved} unresolved`);

  // qualification_results — need the source phase's tournament to resolve
  // team_id -> entrant.
  const [resultRows] = await v1.query<any[]>(
    `SELECT pqr.id, pqr.phase_qualification_id, pqr.entity_type, pqr.entity_id, pqr.rank,
            pq.source_phase_id, tp.tournament_id
     FROM phase_qualification_results pqr
     JOIN phase_qualifications pq ON pq.id = pqr.phase_qualification_id
     LEFT JOIN tournament_phases tp ON tp.id = pq.source_phase_id
     WHERE pqr.entity_type = 'team'`
  );
  let rCreated = 0, rSkipped = 0, rUnresolved = 0;
  for (const row of resultRows as any[]) {
    if (await getMappedId("qualification_result", row.id)) { rSkipped++; continue; }
    const qualificationId = await getMappedId("phase_qualification", row.phase_qualification_id);
    const entrantId = row.tournament_id ? await getMappedId("entrant", entrantKey(row.tournament_id, row.entity_id)) : undefined;
    if (!qualificationId || !entrantId) { rUnresolved++; continue; }
    const [inserted] = await db.insert(qualificationResults).values({
      qualificationId, entrantId, rank: row.rank,
    }).returning({ id: qualificationResults.id });
    await setMappedId("qualification_result", row.id, inserted.id);
    rCreated++;
  }
  console.log(`qualification_results: ${rCreated} created (team-only), ${rSkipped} already migrated, ${rUnresolved} unresolved`);
}

export async function migratePointEntries() {
  await preloadEntityType("team");
  await preloadEntityType("point_type");
  await preloadEntityType("qualification_result");
  const [rows] = await v1.query<any[]>(
    "SELECT id, team_id, point_type_id, amount, phase_qualification_result_id, reason FROM point_entries"
  );
  let created = 0, skipped = 0, unresolved = 0;
  for (const row of rows as any[]) {
    if (await getMappedId("point_entry", row.id)) { skipped++; continue; }
    const teamId = await getMappedId("team", row.team_id);
    const pointTypeId = await getMappedId("point_type", row.point_type_id);
    if (!teamId || !pointTypeId) { unresolved++; continue; }
    const qualificationResultId = row.phase_qualification_result_id
      ? (await getMappedId("qualification_result", row.phase_qualification_result_id)) ?? null
      : null;
    const [inserted] = await db.insert(pointEntries).values({
      teamId, pointTypeId, amount: row.amount, qualificationResultId, reason: row.reason,
    }).returning({ id: pointEntries.id });
    await setMappedId("point_entry", row.id, inserted.id);
    created++;
  }
  console.log(`point_entries: ${created} created, ${skipped} already migrated, ${unresolved} unresolved`);
}

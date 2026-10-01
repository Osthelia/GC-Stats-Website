/**
 * GC-Stats — 04-tournaments
 *
 * V1 to V2 migration step: migrates tournaments, stages, and stage
 * containers, resolving each tournament's point_type_id in a second pass
 * once point_types are already migrated.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db, v1 } from "./connection";
import { getMappedId, batchInsert, setMappedIdsBatch, preloadEntityType } from "./id-map";
import { tournaments, stages, stageContainers } from "../../src/schema";
import { resolvePhaseTree, type V1Phase } from "./phase-tree";

// swiss_buchholz is a V1-only variant of swiss (1 row total) — config.type
// only has "round_robin"/"swiss" (drizzle schema), never the _buchholz
// suffix; the tiebreaker itself is a container_standings_rules concern, not
// part of the format discriminant.
function normalizeGroupFormat(format: string | null): "round_robin" | "swiss" {
  return format === "round_robin" ? "round_robin" : "swiss";
}

function toDate(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  return d.toISOString().slice(0, 10);
}

export async function migrateTournaments() {
  const [rows] = await v1.query<any[]>(
    `SELECT id, name, region, category, point_type_id, prize_pool, location, start_date, end_date,
            status, description, liquipedia_link, player_pov_phrase, active
     FROM tournaments`
  );
  const { created, skipped } = await batchInsert(
    "tournament",
    rows as any[],
    (row) => row.id,
    (row) => ({
      name: row.name,
      region: row.region,
      category: row.category,
      prizePool: row.prize_pool,
      location: row.location,
      startDate: toDate(row.start_date),
      endDate: toDate(row.end_date),
      status: row.status,
      description: row.description,
      active: !!row.active,
      liquipediaLink: row.liquipedia_link ?? null,
      socials: {},
      playerPovPhrase: row.player_pov_phrase,
    }),
    (tx, values) => tx.insert(tournaments).values(values as any).returning({ id: tournaments.id }),
  );
  console.log(`tournaments: ${created} created, ${skipped} already migrated`);

  // point_type_id — patched in a second pass (needs point_types already
  // migrated, and batchInsert's value-builder can't await inside the map).
  let patched = 0;
  for (const row of rows as any[]) {
    if (!row.point_type_id) continue;
    const tournamentId = await getMappedId("tournament", row.id);
    const pointTypeId = await getMappedId("point_type", row.point_type_id);
    if (!tournamentId || !pointTypeId) continue;
    await db.update(tournaments).set({ pointTypeId }).where(eq(tournaments.id, tournamentId));
    patched++;
  }
  if (patched) console.log(`tournaments: ${patched} pointTypeId patched`);
}

// V1's tournament_phases parent_id tree (e.g. "Playoffs" > "Upper Bracket")
// maps onto V2's 2-level stage/stage_container model: only a TOP-LEVEL
// phase (parent_id IS NULL) becomes a `stage`; every descendant phase that
// has matches of its own (any depth — nesting goes up to 3 levels deep in
// real data, not just 2) becomes a `stage_container` directly under that
// stage. Pure grouping phases (no matches, only there to nest/name their
// children, e.g. "Group A" wrapping an "Upper Bracket"/"Lower Bracket"
// pair) produce no row of their own — their name is folded into their
// descendants' container names instead. See phase-tree.ts for the shared
// resolver (also used by repair-stage-hierarchy.ts against already
// migrated tournaments) and its header comment for the verified shape of
// the real V1 data this is built against.
export async function migrateStages() {
  await preloadEntityType("tournament");
  await preloadEntityType("phase_as_stage");
  const [phaseRows] = await v1.query<any[]>(
    "SELECT id, parent_id, tournament_id, name, format, `order` FROM tournament_phases"
  );
  const [matchPhaseRows] = await v1.query<any[]>(
    "SELECT DISTINCT phase_id FROM matches"
  );
  const phaseIdsWithMatches = new Set((matchPhaseRows as any[]).map((r) => r.phase_id as number));
  const plan = resolvePhaseTree(phaseRows as V1Phase[], phaseIdsWithMatches);

  let stagesCreated = 0, stagesSkipped = 0, unresolvedTournament = 0;
  const CHUNK = 500;
  for (let i = 0; i < plan.stages.length; i += CHUNK) {
    const chunk = plan.stages.slice(i, i + CHUNK);
    const toInsert: { legacyId: number; tournamentId: number; name: string; order: number }[] = [];
    for (const s of chunk) {
      if (await getMappedId("phase_as_stage", s.phaseId)) { stagesSkipped++; continue; }
      const tournamentId = await getMappedId("tournament", s.tournamentId);
      if (!tournamentId) { unresolvedTournament++; continue; }
      toInsert.push({ legacyId: s.phaseId, tournamentId, name: s.name, order: s.order });
    }
    if (toInsert.length === 0) continue;
    await db.transaction(async (tx) => {
      const inserted = await tx.insert(stages).values(
        toInsert.map((r) => ({ tournamentId: r.tournamentId, name: r.name, sequenceOrder: r.order }))
      ).returning({ id: stages.id });
      await setMappedIdsBatch("phase_as_stage", toInsert.map((r, idx) => ({ legacyId: r.legacyId, newId: inserted[idx].id })), tx);
    });
    stagesCreated += toInsert.length;
  }
  console.log(`stages: ${stagesCreated} created, ${stagesSkipped} already migrated, ${unresolvedTournament} unresolved tournament`);

  await preloadEntityType("phase_as_container");
  let containersCreated = 0, containersSkipped = 0, unresolvedStage = 0;
  for (let i = 0; i < plan.containers.length; i += CHUNK) {
    const chunk = plan.containers.slice(i, i + CHUNK);
    const toInsert: { legacyId: number; stageId: number; name: string; isGroup: boolean; format: string | null }[] = [];
    for (const c of chunk) {
      if (await getMappedId("phase_as_container", c.leafPhaseId)) { containersSkipped++; continue; }
      const stageId = await getMappedId("phase_as_stage", c.stagePhaseId);
      if (!stageId) { unresolvedStage++; continue; }
      toInsert.push({ legacyId: c.leafPhaseId, stageId, name: c.name, isGroup: c.isGroup, format: c.format });
    }
    if (toInsert.length === 0) continue;
    await db.transaction(async (tx) => {
      const inserted = await tx.insert(stageContainers).values(
        toInsert.map((r) => ({
          stageId: r.stageId,
          name: r.name,
          containerType: r.isGroup ? ("group" as const) : ("bracket" as const),
          config: r.isGroup ? { type: normalizeGroupFormat(r.format) } : {},
        }))
      ).returning({ id: stageContainers.id });
      await setMappedIdsBatch("phase_as_container", toInsert.map((r, idx) => ({ legacyId: r.legacyId, newId: inserted[idx].id })), tx);
    });
    containersCreated += toInsert.length;
  }
  console.log(`stage_containers: ${containersCreated} created, ${containersSkipped} already migrated, ${unresolvedStage} unresolved stage`);
}

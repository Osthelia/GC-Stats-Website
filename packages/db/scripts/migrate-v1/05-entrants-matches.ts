/**
 * GC-Stats — 05-entrants-matches
 *
 * V1 to V2 migration step: migrates tournament_teams into entrants and
 * migrates matches. Entrants are keyed by (tournamentId, teamId) since V1
 * has no standalone entrant id for downstream steps to reference.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db, v1 } from "./connection";
import { getMappedId, setMappedIdsBatch, preloadEntityType } from "./id-map";
import { entrants, matches } from "../../src/schema";

// entrants aren't looked up by their own legacy id anywhere downstream —
// matches reference a (tournament_id, team_id) pair instead. Encode that
// pair into one legacyId for the id-map (team ids top out ~3.7k, well under
// this multiplier) rather than adding a second lookup mechanism.
const ENTRANT_KEY_MULTIPLIER = 10_000_000;
export const entrantKey = (tournamentId: number, teamId: number) => tournamentId * ENTRANT_KEY_MULTIPLIER + teamId;

export async function migrateEntrants() {
  await preloadEntityType("tournament");
  await preloadEntityType("team");
  await preloadEntityType("entrant");
  const [rows] = await v1.query<any[]>("SELECT id, tournament_id, team_id FROM tournament_teams");

  // displayName snapshots the team's current name — pull from the already
  // migrated `teams` rows once, rather than a query per chunk.
  const teamRows = await db.query.teams.findMany();
  const nameById = new Map<number, string>(teamRows.map((t: { id: number; name: string }) => [t.id, t.name]));

  const CHUNK = 500;
  let created = 0, skipped = 0, unresolved = 0;
  for (let i = 0; i < (rows as any[]).length; i += CHUNK) {
    const chunk = (rows as any[]).slice(i, i + CHUNK);
    const toInsert: { legacyKey: number; tournamentId: number; teamId: number; displayName: string }[] = [];
    for (const row of chunk) {
      const tournamentId = await getMappedId("tournament", row.tournament_id);
      const teamId = await getMappedId("team", row.team_id);
      if (!tournamentId || !teamId) { unresolved++; continue; }
      const legacyKey = entrantKey(row.tournament_id, row.team_id);
      if (await getMappedId("entrant", legacyKey)) { skipped++; continue; }
      toInsert.push({ legacyKey, tournamentId, teamId, displayName: "" });
    }
    if (toInsert.length === 0) continue;

    await db.transaction(async (tx) => {
      const inserted = await tx.insert(entrants).values(
        toInsert.map((r) => ({
          tournamentId: r.tournamentId,
          kind: "team" as const,
          teamId: r.teamId,
          displayName: nameById.get(r.teamId) ?? "Unknown",
        }))
      ).returning({ id: entrants.id });
      await setMappedIdsBatch("entrant", toInsert.map((r, idx) => ({ legacyId: r.legacyKey, newId: inserted[idx].id })), tx);
    });
    created += toInsert.length;
  }
  console.log(`entrants: ${created} created, ${skipped} already migrated, ${unresolved} unresolved`);
}

const STATUS_MAP: Record<string, "pending" | "live" | "completed"> = {
  upcoming: "pending",
  live: "live",
  finished: "completed",
};

function computeWinnerId(
  status: string, scoreA: number | null, scoreB: number | null,
  entrantAId: number | null, entrantBId: number | null,
): number | null {
  if (status !== "completed" || scoreA == null || scoreB == null || !entrantAId || !entrantBId) return null;
  if (scoreA === scoreB) return null;
  return scoreA > scoreB ? entrantAId : entrantBId;
}

export async function migrateMatches() {
  await preloadEntityType("phase_as_container");
  await preloadEntityType("entrant");
  await preloadEntityType("match");
  const [rows] = await v1.query<any[]>(
    `SELECT id, tournament_id, phase_id, round_number, round_name, match_order,
            team_a_id, team_b_id, scheduled_at, status, team_a_score, team_b_score, best_of, patch
     FROM matches`
  );

  // Needs async lookups per row (containerId, entrant ids) — the generic
  // batchInsert helper's synchronous value-builder can't do that, so this
  // phase chunks manually instead.
  const CHUNK = 500;
  let done = 0, skippedCount = 0, unresolvedContainer = 0;
  for (let i = 0; i < (rows as any[]).length; i += CHUNK) {
    const chunk = (rows as any[]).slice(i, i + CHUNK);
    const toInsert: { legacyId: number; containerId: number; round: number; label: string | null; bestOf: number;
      status: "pending" | "live" | "completed"; entrantAId: number | null; entrantBId: number | null;
      scoreA: number | null; scoreB: number | null; scheduledAt: Date; patch: string | null }[] = [];
    for (const row of chunk) {
      if (await getMappedId("match", row.id)) { skippedCount++; continue; }
      const containerId = await getMappedId("phase_as_container", row.phase_id);
      if (!containerId) { unresolvedContainer++; continue; }
      const entrantAId = (await getMappedId("entrant", entrantKey(row.tournament_id, row.team_a_id))) ?? null;
      const entrantBId = (await getMappedId("entrant", entrantKey(row.tournament_id, row.team_b_id))) ?? null;
      const status = STATUS_MAP[row.status] ?? "pending";
      toInsert.push({
        legacyId: row.id,
        containerId,
        round: row.round_number ?? 1,
        label: row.round_name || null,
        bestOf: row.best_of ?? 1,
        status,
        entrantAId,
        entrantBId,
        scoreA: status === "pending" ? null : row.team_a_score,
        scoreB: status === "pending" ? null : row.team_b_score,
        scheduledAt: row.scheduled_at,
        patch: row.patch,
      });
    }
    if (toInsert.length === 0) continue;
    await db.transaction(async (tx) => {
      const inserted = await tx.insert(matches).values(
        toInsert.map((r) => ({
          containerId: r.containerId,
          round: r.round,
          label: r.label,
          bestOf: r.bestOf,
          status: r.status,
          entrantAId: r.entrantAId,
          entrantBId: r.entrantBId,
          scoreA: r.scoreA,
          scoreB: r.scoreB,
          winnerId: computeWinnerId(r.status, r.scoreA, r.scoreB, r.entrantAId, r.entrantBId),
          scheduledAt: r.scheduledAt,
          patch: r.patch,
        }))
      ).returning({ id: matches.id });
      await setMappedIdsBatch("match", toInsert.map((r, idx) => ({ legacyId: r.legacyId, newId: inserted[idx].id })), tx);
    });
    done += toInsert.length;
  }
  console.log(`matches: ${done} created, ${skippedCount} already migrated, ${unresolvedContainer} unresolved container`);
}

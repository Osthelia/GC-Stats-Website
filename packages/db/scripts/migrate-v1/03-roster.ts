/**
 * GC-Stats — 03-roster
 *
 * V1 to V2 migration step: migrates the player_team pivot into
 * roster_memberships, batching inserts per chunk and falling back to
 * row by row inserts when a chunk hits the overlap exclusion constraint.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { db, v1 } from "./connection";
import { getMappedId, setMappedId, setMappedIdsBatch, preloadEntityType } from "./id-map";
import { rosterMemberships } from "../../src/schema";

function toDate(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  return d.toISOString().slice(0, 10);
}

function periodRange(from: unknown, to: unknown): string {
  return to ? `[${toDate(from)},${toDate(to)})` : `[${toDate(from)},)`;
}

type RosterCandidate = { legacyId: number; personId: number; teamId: number; role: string; period: string };

// Tries a fast batched insert per chunk first; on failure (typically the
// EXCLUDE (person_id, period, role) constraint — same person/role/overlap
// twice in V1's source data) falls back to inserting that chunk row by row
// so only the actually-offending rows are skipped, not the whole chunk.
async function insertRosterChunk(entityType: string, chunk: RosterCandidate[]): Promise<{ created: number; failed: number }> {
  try {
    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(rosterMemberships).values(
        chunk.map((r) => ({ personId: r.personId, teamId: r.teamId, role: r.role, period: r.period }))
      ).returning({ id: rosterMemberships.id });
      await setMappedIdsBatch(entityType, chunk.map((r, idx) => ({ legacyId: r.legacyId, newId: inserted[idx].id })), tx);
      return { created: chunk.length, failed: 0 };
    });
  } catch {
    let created = 0, failed = 0;
    for (const row of chunk) {
      try {
        await db.transaction(async (tx) => {
          const [inserted] = await tx.insert(rosterMemberships).values({
            personId: row.personId, teamId: row.teamId, role: row.role, period: row.period,
          }).returning({ id: rosterMemberships.id });
          await setMappedId(entityType, row.legacyId, inserted.id, tx);
        });
        created++;
      } catch (e: any) {
        failed++;
        console.warn(`${entityType}#${row.legacyId}: ${e.cause?.message ?? e.message}`);
      }
    }
    return { created, failed };
  }
}

// player_team collapses into roster_memberships (person_id/team_id/role/
// period), see DATABASES.MD §3.2. No V1 row uses an '-inactive' role suffix
// in the real dataset (checked live) so inactiveSince is left null for
// every migrated row.
//
// staff_teams (staff -> team roster) doesn't exist live — confirmed against
// the real V1 database (ER_NO_SUCH_TABLE), and no migration or app code for
// it exists in the V1 repo either (only staff_assignments, a polymorphic
// broadcast/production credit table, and staff_organizations, staff to
// organization — neither is a team roster). Staff never joins a team's
// roster in V1's real data, so there's nothing to migrate here.
export async function migrateRoster() {
  await preloadEntityType("player");
  await preloadEntityType("team");
  await preloadEntityType("player_team");

  let created = 0, skipped = 0, unresolved = 0, failed = 0;
  const CHUNK = 500;

  const [playerTeamRows] = await v1.query<any[]>(
    "SELECT id, player_id, team_id, role, joined_at, left_at FROM player_team"
  );
  const playerCandidates: RosterCandidate[] = [];
  for (const row of playerTeamRows as any[]) {
    if (await getMappedId("player_team", row.id)) { skipped++; continue; }
    const personId = await getMappedId("player", row.player_id);
    const teamId = await getMappedId("team", row.team_id);
    if (!personId || !teamId) { unresolved++; continue; }
    playerCandidates.push({ legacyId: row.id, personId, teamId, role: row.role, period: periodRange(row.joined_at, row.left_at) });
  }
  console.log(`player_team: ${playerCandidates.length} candidates to insert`);
  for (let i = 0; i < playerCandidates.length; i += CHUNK) {
    const { created: c, failed: f } = await insertRosterChunk("player_team", playerCandidates.slice(i, i + CHUNK));
    created += c; failed += f;
    console.log(`  ...${created}/${playerCandidates.length}`);
  }

  console.log(`roster_memberships: ${created} created, ${skipped} already migrated, ${unresolved} unresolved, ${failed} failed`);
}

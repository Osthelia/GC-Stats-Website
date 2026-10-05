/**
 * GC-Stats - admin-tournament-detail
 *
 * Admin queries for a tournament's bracket management page: container
 * options, entrants, and the full stage/container tree with match counts
 * and group entries.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, inArray, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, stages, stageContainers, matches, groupEntries, pickemStageSettings } from "@gc-stats/db";

export type AdminContainerOption = { id: number; name: string; stageName: string; containerType: "bracket" | "group" };

/** Flat list of a tournament's containers (across all its stages), for pickers like the operations page's bulk-create target. */
export async function listTournamentContainerOptions(tournamentId: number): Promise<AdminContainerOption[]> {
  const rows = await db
    .select({ id: stageContainers.id, name: stageContainers.name, stageName: stages.name, containerType: stageContainers.containerType, stageOrder: stages.sequenceOrder })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId))
    .orderBy(asc(stages.sequenceOrder), asc(stageContainers.id));
  return rows.map(({ id, name, stageName, containerType }) => ({ id, name, stageName, containerType }));
}

export type AdminEntrantRow = {
  id: number;
  kind: string;
  teamId: number | null;
  displayName: string;
  seed: number | null;
};

export async function listTournamentEntrants(tournamentId: number): Promise<AdminEntrantRow[]> {
  return db
    .select({ id: entrants.id, kind: entrants.kind, teamId: entrants.teamId, displayName: entrants.displayName, seed: entrants.seed })
    .from(entrants)
    .where(eq(entrants.tournamentId, tournamentId))
    .orderBy(asc(entrants.seed), asc(entrants.id));
}

export type AdminContainerRow = {
  id: number;
  name: string;
  containerType: "bracket" | "group";
  config: unknown;
  status: "pending" | "active" | "completed";
  matchCount: number;
  /** Live or completed matches, the ones a plain delete refuses to wipe. */
  playedMatchCount: number;
  /** group containers only — entrant ids already assigned to `group_entries`. */
  groupEntryEntrantIds: number[];
};

export type AdminStageRow = {
  id: number;
  name: string;
  sequenceOrder: number;
  status: "pending" | "active" | "completed";
  active: boolean;
  /** Explicit, admin-set scheduling window (mirrors V1's `tournament_phases.start_date`/`end_date` —
   *  editable only for the stage itself, never derived from its matches). Either may be set alone. */
  startDate: string | null;
  endDate: string | null;
  liquipediaLink: string | null;
  containers: AdminContainerRow[];
  pickemEnabled: boolean;
  pickemOpensAt: string | null;
};

export async function listTournamentStages(tournamentId: number): Promise<AdminStageRow[]> {
  // Everything keyed off the tournament id through subqueries, so it all runs in one round trip.
  const tournamentStageIds = db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, tournamentId));
  const tournamentContainerIds = db.select({ id: stageContainers.id }).from(stageContainers).where(inArray(stageContainers.stageId, tournamentStageIds));

  const [stageRows, unsortedContainerRows, matchCounts, groupEntryRows, pickemRows] = await Promise.all([
    db.select().from(stages).where(eq(stages.tournamentId, tournamentId)).orderBy(asc(stages.sequenceOrder), asc(stages.id)),
    db.select().from(stageContainers).where(inArray(stageContainers.stageId, tournamentStageIds)).orderBy(asc(stageContainers.id)),
    db
      .select({ containerId: matches.containerId, count: sql<number>`count(*)::int`, played: sql<number>`count(*) filter (where ${matches.status} in ('live', 'completed'))::int` })
      .from(matches)
      .where(inArray(matches.containerId, tournamentContainerIds))
      .groupBy(matches.containerId),
    db.select({ containerId: groupEntries.containerId, entrantId: groupEntries.entrantId }).from(groupEntries).where(inArray(groupEntries.containerId, tournamentContainerIds)),
    db.select().from(pickemStageSettings).where(inArray(pickemStageSettings.stageId, tournamentStageIds)),
  ]);
  if (stageRows.length === 0) return [];

  // Creation order matters beyond display: the bracket layout algorithm
  // (lib/bracket-layout.ts) uses this array's order as its tie-break for
  // which lane a merged container (e.g. a grand final) anchors to. Creation
  // order alone isn't reliable though — the V1 migration's phase-tree walk
  // doesn't guarantee an "Upper Bracket" container was inserted before its
  // sibling "Lower Bracket" (explicit user report: Lower sometimes rendered
  // above Upper). Every naming scheme in use always starts a lower-bracket
  // container's name with "Lower", so stable-sorting those after everything
  // else fixes the lane order without disturbing id order among non-Lower
  // containers (including across separately-grouped brackets, each grouped
  // subset keeps its own relative order — see bracket-group-containers.ts).
  const containerRows = unsortedContainerRows.sort(
    (a, b) => Number(a.name.trim().toLowerCase().startsWith("lower")) - Number(b.name.trim().toLowerCase().startsWith("lower")),
  );
  const countByContainer = new Map(matchCounts.map((r) => [r.containerId, r.count]));
  const playedByContainer = new Map(matchCounts.map((r) => [r.containerId, r.played]));

  const entrantIdsByContainer = new Map<number, number[]>();
  for (const row of groupEntryRows) {
    const list = entrantIdsByContainer.get(row.containerId) ?? [];
    list.push(row.entrantId);
    entrantIdsByContainer.set(row.containerId, list);
  }

  const pickemByStage = new Map(pickemRows.map((r) => [r.stageId, r]));

  return stageRows.map((stage) => ({
    id: stage.id,
    name: stage.name,
    sequenceOrder: stage.sequenceOrder,
    status: stage.status,
    active: stage.active,
    startDate: stage.startDate,
    endDate: stage.endDate,
    liquipediaLink: stage.liquipediaLink,
    pickemEnabled: pickemByStage.get(stage.id)?.enabled ?? false,
    pickemOpensAt: pickemByStage.get(stage.id)?.opensAt.toISOString() ?? null,
    containers: containerRows
      .filter((c) => c.stageId === stage.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        containerType: c.containerType,
        config: c.config,
        status: c.status,
        matchCount: countByContainer.get(c.id) ?? 0,
        playedMatchCount: playedByContainer.get(c.id) ?? 0,
        groupEntryEntrantIds: entrantIdsByContainer.get(c.id) ?? [],
      })),
  }));
}

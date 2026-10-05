/**
 * GC-Stats - admin-containers
 *
 * Admin server actions for stage containers (brackets and groups) inside a
 * tournament stage: creation, ordering, type/format changes and
 * point/qualification settings.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stageContainers, stages, entrants, groupEntries, matches, bracketEdges, maps, mapRoundPlayerPositionsRaw, PERMISSIONS } from "@gc-stats/db";
import { rebuildGroupEntriesFromMatches } from "@/lib/bracket/group-progression";
import { requireActorPermission } from "@/lib/rbac";
import { containerOrderBy, nextContainerDisplayOrder } from "@/lib/bracket/container-order";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

export type ContainerField =
  | "name"
  | "containerType"
  | "qualifyAtWins"
  | "eliminateAtLosses"
  | "maxRounds"
  | "matchWinPoints"
  | "mapWinPoints"
  | "roundWinPoints"
  | "matchForfeitWinPoints"
  | "mapForfeitWinPoints";
export type ContainerFieldErrors = Partial<Record<ContainerField, string>>;
export type ContainerResult = { ok: true; id: number } | { ok: false; fieldErrors: ContainerFieldErrors };

/** Every point value is independently optional (2026-08-31, explicit user
 *  spec) — `null` means "don't award points for this dimension" — shared by
 *  both group formats since either can use a points-based tiebreaker. */
export type PointsInput = {
  matchWinPoints: number | null;
  mapWinPoints: number | null;
  roundWinPoints: number | null;
  matchForfeitWinPoints: number | null;
  mapForfeitWinPoints: number | null;
};

export type ContainerInput =
  | { name: string; containerType: "bracket" }
  | ({ name: string; containerType: "group"; groupFormat: "swiss" | "round_robin"; qualifyAtWins: number | null; eliminateAtLosses: number | null; maxRounds: number | null } & PointsInput);

const POINTS_FIELDS: (keyof PointsInput)[] = ["matchWinPoints", "mapWinPoints", "roundWinPoints", "matchForfeitWinPoints", "mapForfeitWinPoints"];

function validateContainer(input: ContainerInput): ContainerFieldErrors {
  const fieldErrors: ContainerFieldErrors = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  if (input.containerType === "group") {
    if (input.groupFormat === "swiss") {
      if (input.qualifyAtWins !== null && (!Number.isInteger(input.qualifyAtWins) || input.qualifyAtWins < 1)) fieldErrors.qualifyAtWins = "invalid";
      if (input.eliminateAtLosses !== null && (!Number.isInteger(input.eliminateAtLosses) || input.eliminateAtLosses < 1)) fieldErrors.eliminateAtLosses = "invalid";
      if (!Number.isInteger(input.maxRounds) || (input.maxRounds ?? 0) < 1) fieldErrors.maxRounds = "invalid";
    }
    for (const field of POINTS_FIELDS) {
      const value = input[field];
      if (value !== null && !Number.isFinite(value)) fieldErrors[field] = "invalid";
    }
  }

  return fieldErrors;
}

function buildPointsConfig(input: PointsInput): Record<string, unknown> | null {
  const active = POINTS_FIELDS.some((f) => input[f] !== null);
  if (!active) return null;
  return {
    matchWin: input.matchWinPoints,
    mapWin: input.mapWinPoints,
    roundWin: input.roundWinPoints,
    matchForfeitWin: input.matchForfeitWinPoints,
    mapForfeitWin: input.mapForfeitWinPoints,
  };
}

function buildConfig(input: ContainerInput): Record<string, unknown> {
  if (input.containerType === "bracket") return {};
  const pointsConfig = buildPointsConfig(input);
  if (input.groupFormat === "round_robin") {
    return { type: "round_robin", tiebreakers: pointsConfig ? ["points", "round_diff", "head_to_head", "seed"] : ["round_diff", "head_to_head", "seed"], pointsConfig };
  }
  return {
    type: "swiss",
    qualifyAtWins: input.qualifyAtWins,
    eliminateAtLosses: input.eliminateAtLosses,
    maxRounds: input.maxRounds,
    roundFormat: {},
    tiebreakers: pointsConfig ? ["points", "buchholz", "round_diff", "seed"] : ["buchholz", "round_diff", "seed"],
    pointsConfig,
  };
}

export async function createContainer(stageId: number, input: ContainerInput): Promise<ContainerResult> {
  await requireTournamentsActor();

  const [stage] = await db.select({ id: stages.id, tournamentId: stages.tournamentId }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) return { ok: false, fieldErrors: { name: "stageNotFound" } };

  const fieldErrors = validateContainer(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(stageContainers)
    .values({ stageId, name: input.name.trim(), containerType: input.containerType, config: buildConfig(input), displayOrder: nextContainerDisplayOrder(stageId) })
    .returning({ id: stageContainers.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

/**
 * Never regenerates matches, works regardless of whether the container
 * already has matches. `containerType`/`groupFormat` can be changed
 * (historically-migrated containers often landed as brackets while they
 * were really Swiss/round robin): converting bracket -> group drops the
 * bracket edges touching its matches (a group has no lineage) and rebuilds
 * `group_entries` from those matches; group -> bracket drops the now
 * unused `group_entries`. The `legacyImportTarget` flag is preserved.
 */
export async function updateContainer(id: number, stageId: number, input: ContainerInput): Promise<ContainerResult> {
  await requireTournamentsActor();

  const [existing] = await db
    .select({ id: stageContainers.id, containerType: stageContainers.containerType, config: stageContainers.config })
    .from(stageContainers)
    .where(and(eq(stageContainers.id, id), eq(stageContainers.stageId, stageId)))
    .limit(1);
  if (!existing) return { ok: false, fieldErrors: { name: "notFound" } };

  const fieldErrors = validateContainer(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const legacyImportTarget = (existing.config as { legacyImportTarget?: boolean } | null)?.legacyImportTarget === true;
  const config = legacyImportTarget ? { ...buildConfig(input), legacyImportTarget: true } : buildConfig(input);

  await db.transaction(async (tx) => {
    await tx.update(stageContainers).set({ name: input.name.trim(), containerType: input.containerType, config }).where(eq(stageContainers.id, id));
    if (existing.containerType === input.containerType) return;

    if (input.containerType === "group") {
      const containerMatchIds = tx.select({ id: matches.id }).from(matches).where(eq(matches.containerId, id));
      await tx.delete(bracketEdges).where(or(inArray(bracketEdges.fromMatchId, containerMatchIds), inArray(bracketEdges.toMatchId, containerMatchIds)));
      await rebuildGroupEntriesFromMatches(tx, id);
    } else {
      await tx.delete(groupEntries).where(eq(groupEntries.containerId, id));
    }
  });

  return { ok: true, id };
}

export type DeleteContainerResult = { ok: true } | { ok: false; error: "notFound" | "invalid" | "hasPlayedMatches" };

/** Without `force`, refuses when a match is live or completed. With it, the
 *  container goes with every match, map and stat row underneath. */
export async function deleteContainer(id: number, stageId: number, force: boolean): Promise<DeleteContainerResult> {
  await requireTournamentsActor();

  if (!Number.isInteger(id) || !Number.isInteger(stageId) || typeof force !== "boolean") return { ok: false, error: "invalid" };

  const [existing] = await db.select({ id: stageContainers.id }).from(stageContainers).where(and(eq(stageContainers.id, id), eq(stageContainers.stageId, stageId))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  if (!force) {
    const [played] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.containerId, id), inArray(matches.status, ["live", "completed"])))
      .limit(1);
    if (played) return { ok: false, error: "hasPlayedMatches" };
  }

  await db.transaction(async (tx) => {
    // map_round_player_positions_raw.map_id has no ON DELETE CASCADE, cleared first so the maps can go.
    const containerMapIds = tx.select({ id: maps.id }).from(maps).innerJoin(matches, eq(matches.id, maps.matchId)).where(eq(matches.containerId, id));
    await tx.delete(mapRoundPlayerPositionsRaw).where(inArray(mapRoundPlayerPositionsRaw.mapId, containerMapIds));
    await tx.delete(stageContainers).where(eq(stageContainers.id, id));
  });
  return { ok: true };
}

export type MoveContainerResult = { ok: true } | { ok: false; error: "notFound" | "invalid" | "cannotMove" };

/** Swaps a container with its neighbour, then renumbers the whole stage 1..n. */
export async function moveContainer(id: number, stageId: number, direction: "up" | "down"): Promise<MoveContainerResult> {
  await requireTournamentsActor();

  if (!Number.isInteger(id) || !Number.isInteger(stageId) || (direction !== "up" && direction !== "down")) return { ok: false, error: "invalid" };

  const siblings = await db.select({ id: stageContainers.id }).from(stageContainers).where(eq(stageContainers.stageId, stageId)).orderBy(...containerOrderBy);
  const index = siblings.findIndex((c) => c.id === id);
  if (index === -1) return { ok: false, error: "notFound" };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= siblings.length) return { ok: false, error: "cannotMove" };

  const ordered = siblings.map((c) => c.id);
  [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];

  await db.transaction(async (tx) => {
    for (const [position, containerId] of ordered.entries()) {
      await tx.update(stageContainers).set({ displayOrder: position + 1 }).where(eq(stageContainers.id, containerId));
    }
  });
  return { ok: true };
}

export type AssignEntrantsResult = { ok: true } | { ok: false; error: "notFound" };

/** Populates `group_entries` for a group container from a set of the
 *  tournament's own entrants (their existing seed carried over) — the
 *  starting roster a Swiss/round-robin group pairs from. Re-runnable:
 *  entrants already present are left untouched (onConflictDoNothing on the
 *  (containerId, entrantId) pair isn't a declared unique constraint, so
 *  duplicates are avoided by checking first instead). */
export async function assignEntrantsToContainer(containerId: number, entrantIds: number[]): Promise<AssignEntrantsResult> {
  await requireTournamentsActor();

  const [container] = await db
    .select({ id: stageContainers.id, tournamentId: stages.tournamentId })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stageContainers.id, containerId))
    .limit(1);
  if (!container) return { ok: false, error: "notFound" };

  const already = await db.select({ entrantId: groupEntries.entrantId }).from(groupEntries).where(eq(groupEntries.containerId, containerId));
  const alreadyIds = new Set(already.map((r) => r.entrantId));

  const entrantRows = await db.select({ id: entrants.id, seed: entrants.seed }).from(entrants).where(eq(entrants.tournamentId, container.tournamentId));
  const validIds = new Set(entrantRows.map((r) => r.id));
  const seedById = new Map(entrantRows.map((r) => [r.id, r.seed]));

  const newIds = entrantIds.filter((id) => !alreadyIds.has(id));
  const toAdd = newIds.filter((id) => validIds.has(id));
  if (toAdd.length !== newIds.length) return { ok: false, error: "notFound" };
  if (toAdd.length === 0) return { ok: true };

  await db.insert(groupEntries).values(toAdd.map((entrantId) => ({ containerId, entrantId, seed: seedById.get(entrantId) ?? null })));
  return { ok: true };
}

export type RemoveGroupEntryResult = { ok: true } | { ok: false; error: "notFound" };

export async function removeEntrantFromContainer(containerId: number, entrantId: number): Promise<RemoveGroupEntryResult> {
  await requireTournamentsActor();
  const [existing] = await db
    .select({ id: groupEntries.id })
    .from(groupEntries)
    .where(and(eq(groupEntries.containerId, containerId), eq(groupEntries.entrantId, entrantId)))
    .limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  await db.delete(groupEntries).where(eq(groupEntries.id, existing.id));
  return { ok: true };
}

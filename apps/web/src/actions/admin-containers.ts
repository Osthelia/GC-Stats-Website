/**
 * GC-Stats - admin-containers
 *
 * Admin server actions for stage containers (brackets and groups) inside a
 * tournament stage: creation, ordering, type/format changes and
 * point/qualification settings.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stageContainers, stages, entrants, groupEntries, matches, bracketEdges, maps, mapRoundPlayerPositionsRaw, PERMISSIONS } from "@gc-stats/db";
import { rebuildGroupEntriesFromMatches } from "@/lib/bracket/group-progression";
import { requireActorPermission } from "@/lib/rbac";
import { containerOrderBy, nextContainerDisplayOrder } from "@/lib/bracket/container-order";
import { isStageStatus, type StageStatus } from "@/lib/stage-status";
import { checkMove, placeAmongSiblings, subtreeOf, type TreeRow } from "@osthelia/bracket-engine";
import { MAX_POINTS, POINTS_FIELDS, ROUND_ROBIN_TIEBREAKERS, SWISS_TIEBREAKERS, type PointsField } from "@/lib/bracket/config-types";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

export type ContainerField =
  | "name"
  | "parentId"
  | "status"
  | "containerType"
  | "qualifyAtWins"
  | "eliminateAtLosses"
  | "maxRounds"
  | "tiebreakers"
  | `points.${PointsField}`;
export type ContainerFieldErrors = Partial<Record<ContainerField, string>>;
export type ContainerResult = { ok: true; id: number } | { ok: false; fieldErrors: ContainerFieldErrors };

/** Null turns the points off, a null value inside is a field left empty. */
export type PointsInput = Record<PointsField, number | null> | null;

export type ContainerInput =
  | { name: string; status: StageStatus; containerType: "bracket"; parentId: number | null }
  | {
      name: string;
      status: StageStatus;
      containerType: "group";
      parentId: number | null;
      groupFormat: "swiss" | "round_robin";
      qualifyAtWins: number | null;
      eliminateAtLosses: number | null;
      maxRounds: number | null;
      // Ordered, wins always count first
      tiebreakers: string[];
      pointsConfig: PointsInput;
    };

function validateContainer(input: ContainerInput): ContainerFieldErrors {
  const fieldErrors: ContainerFieldErrors = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";
  if (!isStageStatus(input.status)) fieldErrors.status = "invalid";

  if (input.containerType === "group") {
    if (input.groupFormat === "swiss") {
      if (input.qualifyAtWins !== null && (!Number.isInteger(input.qualifyAtWins) || input.qualifyAtWins < 1)) fieldErrors.qualifyAtWins = "invalid";
      if (input.eliminateAtLosses !== null && (!Number.isInteger(input.eliminateAtLosses) || input.eliminateAtLosses < 1)) fieldErrors.eliminateAtLosses = "invalid";
      if (!Number.isInteger(input.maxRounds) || (input.maxRounds ?? 0) < 1) fieldErrors.maxRounds = "invalid";
    }
    const allowed: readonly string[] = input.groupFormat === "swiss" ? SWISS_TIEBREAKERS : ROUND_ROBIN_TIEBREAKERS;
    const tiebreakers: unknown = input.tiebreakers;
    if (!Array.isArray(tiebreakers) || tiebreakers.some((tb) => !allowed.includes(tb)) || new Set(tiebreakers).size !== tiebreakers.length) {
      fieldErrors.tiebreakers = "tiebreakersInvalid";
    }
    if (input.pointsConfig !== null) {
      for (const field of POINTS_FIELDS) {
        const value: unknown = input.pointsConfig?.[field] ?? null;
        if (value === null) fieldErrors[`points.${field}`] = "required";
        else if (typeof value !== "number" || !Number.isInteger(value) || Math.abs(value) > MAX_POINTS) fieldErrors[`points.${field}`] = "pointsValue";
      }
    }
  }

  return fieldErrors;
}

function buildConfig(input: ContainerInput): Record<string, unknown> {
  if (input.containerType === "bracket") return {};
  const { tiebreakers } = input;
  const pointsConfig = input.pointsConfig && Object.fromEntries(POINTS_FIELDS.map((f) => [f, input.pointsConfig![f]]));
  if (input.groupFormat === "round_robin") return { type: "round_robin", tiebreakers, pointsConfig };
  return {
    type: "swiss",
    qualifyAtWins: input.qualifyAtWins,
    eliminateAtLosses: input.eliminateAtLosses,
    maxRounds: input.maxRounds,
    roundFormat: {},
    tiebreakers,
    pointsConfig,
  };
}

/** Rows of a stage in the shape the set tree helpers read. */
async function loadTreeRows(stageId: number): Promise<(TreeRow<number> & { name: string })[]> {
  const rows = await db
    .select({ id: stageContainers.id, parentId: stageContainers.parentId, containerType: stageContainers.containerType, status: stageContainers.status, name: stageContainers.name })
    .from(stageContainers)
    .where(eq(stageContainers.stageId, stageId))
    .orderBy(...containerOrderBy);
  return rows.map((r) => ({ id: r.id, parentId: r.parentId, isSet: r.containerType === "set", status: r.status, name: r.name }));
}

function validateSetName(name: string): ContainerFieldErrors {
  const trimmed = name.trim();
  if (!trimmed) return { name: "required" };
  if (trimmed.length > 255) return { name: "tooLong" };
  return {};
}

/** A set groups containers under one name. `parentId` nests it in another set of the same stage. */
export async function createContainerSet(stageId: number, input: { name: string; parentId: number | null }): Promise<ContainerResult> {
  await requireTournamentsActor();

  const [stage] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) return { ok: false, fieldErrors: { name: "stageNotFound" } };

  const fieldErrors = validateSetName(input.name);
  if (input.parentId !== null) {
    const parent = (await loadTreeRows(stageId)).find((r) => r.id === input.parentId);
    if (!parent || !parent.isSet) fieldErrors.parentId = "invalid";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(stageContainers)
    .values({ stageId, name: input.name.trim(), status: "pending", containerType: "set", parentId: input.parentId, config: {}, displayOrder: nextContainerDisplayOrder(stageId) })
    .returning({ id: stageContainers.id });
  if (!created) throw new Error("Insert returned no row");
  return { ok: true, id: created.id };
}

export async function renameContainerSet(id: number, stageId: number, input: { name: string }): Promise<ContainerResult> {
  await requireTournamentsActor();

  const [existing] = await db
    .select({ id: stageContainers.id })
    .from(stageContainers)
    .where(and(eq(stageContainers.id, id), eq(stageContainers.stageId, stageId), eq(stageContainers.containerType, "set")))
    .limit(1);
  if (!existing) return { ok: false, fieldErrors: { name: "notFound" } };

  const fieldErrors = validateSetName(input.name);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db.update(stageContainers).set({ name: input.name.trim() }).where(eq(stageContainers.id, id));
  return { ok: true, id };
}

export type MoveToSetResult = { ok: true } | { ok: false; error: "notFound" | "invalid" | "parentInvalid" };

/** Moves a container into a set (or back to the root of its stage with a null parent), last among its new siblings unless an index is given. */
export async function moveContainerToSet(id: number, stageId: number, parentId: number | null, index?: number): Promise<MoveToSetResult> {
  await requireTournamentsActor();

  if (!Number.isInteger(id) || !Number.isInteger(stageId) || (parentId !== null && !Number.isInteger(parentId))) return { ok: false, error: "invalid" };
  if (index !== undefined && (!Number.isInteger(index) || index < 0)) return { ok: false, error: "invalid" };

  const rows = await loadTreeRows(stageId);
  const check = checkMove(rows, id, parentId);
  if (check !== "ok") return { ok: false, error: check };

  const ordered = placeAmongSiblings(rows, id, parentId, index);
  await db.transaction(async (tx) => {
    for (const [position, containerId] of ordered.entries()) {
      await tx.update(stageContainers).set({ displayOrder: position + 1, ...(containerId === id ? { parentId } : {}) }).where(eq(stageContainers.id, containerId));
    }
  });
  return { ok: true };
}

export async function createContainer(stageId: number, input: ContainerInput): Promise<ContainerResult> {
  await requireTournamentsActor();

  const [stage] = await db.select({ id: stages.id, tournamentId: stages.tournamentId }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) return { ok: false, fieldErrors: { name: "stageNotFound" } };

  const fieldErrors = validateContainer(input);
  if (input.parentId !== null) {
    const parent = (await loadTreeRows(stageId)).find((r) => r.id === input.parentId);
    if (!parent || !parent.isSet) fieldErrors.parentId = "invalid";
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(stageContainers)
    .values({ stageId, name: input.name.trim(), status: input.status, containerType: input.containerType, parentId: input.parentId, config: buildConfig(input), displayOrder: nextContainerDisplayOrder(stageId) })
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
    await tx.update(stageContainers).set({ name: input.name.trim(), status: input.status, containerType: input.containerType, config }).where(eq(stageContainers.id, id));
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

  // A set goes with everything nested in it
  const ids = subtreeOf(await loadTreeRows(stageId), id).map((r) => r.id);
  if (ids.length === 0) return { ok: false, error: "notFound" };

  if (!force) {
    const [played] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(inArray(matches.containerId, ids), inArray(matches.status, ["live", "completed"])))
      .limit(1);
    if (played) return { ok: false, error: "hasPlayedMatches" };
  }

  await db.transaction(async (tx) => {
    // map_round_player_positions_raw.map_id has no ON DELETE CASCADE, cleared first so the maps can go.
    const containerMapIds = tx.select({ id: maps.id }).from(maps).innerJoin(matches, eq(matches.id, maps.matchId)).where(inArray(matches.containerId, ids));
    await tx.delete(mapRoundPlayerPositionsRaw).where(inArray(mapRoundPlayerPositionsRaw.mapId, containerMapIds));
    await tx.delete(stageContainers).where(eq(stageContainers.id, id));
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

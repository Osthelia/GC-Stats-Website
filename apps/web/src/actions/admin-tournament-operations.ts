/**
 * GC-Stats - admin-tournament-operations
 *
 * Admin server actions for bulk operations across a tournament's matches,
 * such as bulk-patching the game patch version over a date range.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { matches, stages, stageContainers, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

async function tournamentContainerIds(tournamentId: number, containerId: number | null): Promise<number[] | "notFound"> {
  const rows = await db
    .select({ id: stageContainers.id })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .where(eq(stages.tournamentId, tournamentId));
  const ids = rows.map((r) => r.id);
  if (containerId === null) return ids;
  return ids.includes(containerId) ? [containerId] : "notFound";
}

export type BulkPatchInput = { patch: string; containerId: number | null; dateFrom: string; dateTo: string };
export type BulkPatchField = "patch" | "dateFrom" | "dateTo" | "containerId";
export type BulkPatchFieldErrors = Partial<Record<BulkPatchField, string>>;
export type BulkPatchResult = { ok: true; count: number } | { ok: false; fieldErrors: BulkPatchFieldErrors };

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

export async function bulkPatchMatches(tournamentId: number, input: BulkPatchInput): Promise<BulkPatchResult> {
  await requireTournamentsActor();

  const fieldErrors: BulkPatchFieldErrors = {};
  const patch = input.patch.trim();
  if (!patch) fieldErrors.patch = "required";
  else if (patch.length > 20) fieldErrors.patch = "tooLong";

  if (input.dateFrom && !isValidDate(input.dateFrom)) fieldErrors.dateFrom = "invalid";
  if (input.dateTo && !isValidDate(input.dateTo)) fieldErrors.dateTo = "invalid";
  if (input.dateFrom && input.dateTo && isValidDate(input.dateFrom) && isValidDate(input.dateTo) && input.dateTo < input.dateFrom) {
    fieldErrors.dateTo = "dateRange";
  }

  const containerIds = await tournamentContainerIds(tournamentId, input.containerId);
  if (containerIds === "notFound") fieldErrors.containerId = "containerNotFound";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  if (containerIds === "notFound") throw new Error("unreachable");

  if (containerIds.length === 0) return { ok: true, count: 0 };

  const conditions = [inArray(matches.containerId, containerIds)];
  if (input.dateFrom) conditions.push(gte(matches.scheduledAt, new Date(`${input.dateFrom}T00:00:00Z`)));
  if (input.dateTo) conditions.push(lt(matches.scheduledAt, new Date(new Date(`${input.dateTo}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)));

  const updated = await db
    .update(matches)
    .set({ patch })
    .where(and(...conditions))
    .returning({ id: matches.id });

  return { ok: true, count: updated.length };
}

export type BulkCreateInput = { containerId: number | null; count: string; scheduledAt: string; bestOf: string };
export type BulkCreateField = "containerId" | "count" | "scheduledAt" | "bestOf";
export type BulkCreateFieldErrors = Partial<Record<BulkCreateField, string>>;
export type BulkCreateResult = { ok: true; count: number } | { ok: false; fieldErrors: BulkCreateFieldErrors };

export async function bulkCreateMatches(tournamentId: number, input: BulkCreateInput): Promise<BulkCreateResult> {
  await requireTournamentsActor();

  const fieldErrors: BulkCreateFieldErrors = {};

  if (input.containerId === null) fieldErrors.containerId = "required";
  else {
    const containerIds = await tournamentContainerIds(tournamentId, input.containerId);
    if (containerIds === "notFound") fieldErrors.containerId = "containerNotFound";
  }

  const count = Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 100) fieldErrors.count = "countRange";

  const bestOf = Number(input.bestOf);
  if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf > 5) fieldErrors.bestOf = "invalid";

  const scheduledDate = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (!input.scheduledAt) fieldErrors.scheduledAt = "required";
  else if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) fieldErrors.scheduledAt = "invalid";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const containerId = input.containerId as number;

  const [maxRoundRow] = await db.select({ maxRound: sql<number>`coalesce(max(${matches.round}), 0)::int` }).from(matches).where(eq(matches.containerId, containerId));
  const round = (maxRoundRow?.maxRound ?? 0) + 1;

  const rows = Array.from({ length: count }, () => ({
    containerId,
    round,
    bestOf,
    status: "pending" as const,
    scheduledAt: scheduledDate as Date,
  }));

  const created = await db.insert(matches).values(rows).returning({ id: matches.id });

  return { ok: true, count: created.length };
}


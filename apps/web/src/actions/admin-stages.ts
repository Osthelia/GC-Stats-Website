/**
 * GC-Stats - admin-stages
 *
 * Admin server actions for tournament stages: create/edit name, sequence
 * order, status, dates and Liquipedia link.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stages, tournaments, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

export type StageField = "name" | "sequenceOrder" | "status" | "startDate" | "endDate" | "liquipediaLink";
export type StageFieldErrors = Partial<Record<StageField, string>>;
export type StageResult = { ok: true; id: number } | { ok: false; fieldErrors: StageFieldErrors };

const STAGE_STATUSES = ["pending", "active", "completed"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export type StageInput = { name: string; sequenceOrder: number; status: StageStatus; startDate: string | null; endDate: string | null; liquipediaLink: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateStage(input: StageInput): StageFieldErrors {
  const fieldErrors: StageFieldErrors = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";
  if (!Number.isInteger(input.sequenceOrder) || input.sequenceOrder < 1) fieldErrors.sequenceOrder = "invalid";
  if (!STAGE_STATUSES.includes(input.status)) fieldErrors.status = "invalid";

  if (input.startDate !== null && !DATE_RE.test(input.startDate)) fieldErrors.startDate = "invalid";
  if (input.endDate !== null && !DATE_RE.test(input.endDate)) fieldErrors.endDate = "invalid";
  if (!fieldErrors.startDate && !fieldErrors.endDate && input.startDate !== null && input.endDate !== null && input.endDate < input.startDate) {
    fieldErrors.endDate = "endBeforeStart";
  }

  const liquipediaLink = input.liquipediaLink.trim();
  if (liquipediaLink && !isValidUrl(liquipediaLink)) fieldErrors.liquipediaLink = "invalid";

  return fieldErrors;
}

export async function createStage(tournamentId: number, input: StageInput): Promise<StageResult> {
  await requireTournamentsActor();

  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { ok: false, fieldErrors: { name: "tournamentNotFound" } };

  const fieldErrors = validateStage(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(stages)
    .values({
      tournamentId,
      name: input.name.trim(),
      sequenceOrder: input.sequenceOrder,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      liquipediaLink: input.liquipediaLink.trim() || null,
    })
    .returning({ id: stages.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export async function updateStage(id: number, tournamentId: number, input: StageInput): Promise<StageResult> {
  await requireTournamentsActor();

  const [existingRow] = await db.select({ id: stages.id }).from(stages).where(and(eq(stages.id, id), eq(stages.tournamentId, tournamentId))).limit(1);
  if (!existingRow) return { ok: false, fieldErrors: { name: "notFound" } };

  const fieldErrors = validateStage(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(stages)
    .set({
      name: input.name.trim(),
      sequenceOrder: input.sequenceOrder,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      liquipediaLink: input.liquipediaLink.trim() || null,
    })
    .where(eq(stages.id, id));
  return { ok: true, id };
}

export type ToggleStageActiveResult = { ok: true; active: boolean } | { ok: false; error: "notFound" };

/** Public-visibility toggle only (mirrors tournaments.active) — never gates admin editing, cf. SUIVI.md. */
export async function toggleStageActive(id: number): Promise<ToggleStageActiveResult> {
  await requireTournamentsActor();

  const [existing] = await db.select({ id: stages.id, active: stages.active }).from(stages).where(eq(stages.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const active = !existing.active;
  await db.update(stages).set({ active }).where(eq(stages.id, id));

  return { ok: true, active };
}

export type DeleteStageResult = { ok: true } | { ok: false; error: "notFound" | "hasPlayedMatches" };

export async function deleteStage(id: number, tournamentId: number): Promise<DeleteStageResult> {
  await requireTournamentsActor();

  const [existing] = await db.select({ id: stages.id }).from(stages).where(and(eq(stages.id, id), eq(stages.tournamentId, tournamentId))).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await db.delete(stages).where(eq(stages.id, id));
  } catch (err) {
    const code = (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23503") return { ok: false, error: "hasPlayedMatches" };
    throw err;
  }
  return { ok: true };
}

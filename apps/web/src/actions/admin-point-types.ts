/**
 * GC-Stats - admin-point-types
 *
 * Admin server actions managing point types (ranking systems with a
 * validity date range) used to score tournament placements.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, gte, lte, ne } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { pointTypes, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";

async function requirePointTypesActor(): Promise<void> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it.
  await requireActorPermission(PERMISSIONS.pointTypesManage);
}

export type PointTypeField = "name" | "label" | "startDate" | "endDate";
export type PointTypeFieldErrors = Partial<Record<PointTypeField, string>>;
export type PointTypeResult = { ok: true; id: number } | { ok: false; fieldErrors: PointTypeFieldErrors };

export type PointTypeInput = {
  name: string;
  label: string;
  startDate: string;
  endDate: string;
};

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

async function validatePointType(input: PointTypeInput, excludeId?: number): Promise<PointTypeFieldErrors> {
  const fieldErrors: PointTypeFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 100) fieldErrors.name = "tooLong";

  const label = input.label.trim();
  if (!label) fieldErrors.label = "required";
  else if (label.length > 50) fieldErrors.label = "tooLong";

  if (!input.startDate) fieldErrors.startDate = "required";
  else if (!isValidDate(input.startDate)) fieldErrors.startDate = "invalid";

  if (!input.endDate) fieldErrors.endDate = "required";
  else if (!isValidDate(input.endDate)) fieldErrors.endDate = "invalid";

  if (!fieldErrors.startDate && !fieldErrors.endDate && input.endDate < input.startDate) {
    fieldErrors.endDate = "beforeStart";
  }

  // Same name across separate years is the documented, intended shape (e.g.
  // "Cash Cup Points" has one row per year) — only reject a genuine overlap:
  // same name AND an overlapping date range, which would make resolving
  // "the Cash Cup Points row for this date" ambiguous.
  if (name && !fieldErrors.name && !fieldErrors.startDate && !fieldErrors.endDate) {
    const conditions = [eq(pointTypes.name, name), lte(pointTypes.startDate, input.endDate), gte(pointTypes.endDate, input.startDate)];
    if (excludeId !== undefined) conditions.push(ne(pointTypes.id, excludeId));
    const [existing] = await db
      .select({ id: pointTypes.id })
      .from(pointTypes)
      .where(and(...conditions))
      .limit(1);
    if (existing) fieldErrors.startDate = "overlapping";
  }

  return fieldErrors;
}

export async function createPointType(input: PointTypeInput): Promise<PointTypeResult> {
  await requirePointTypesActor();

  const fieldErrors = await validatePointType(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(pointTypes)
    .values({ name: input.name.trim(), label: input.label.trim(), startDate: input.startDate, endDate: input.endDate })
    .returning({ id: pointTypes.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export async function updatePointType(id: number, input: PointTypeInput): Promise<PointTypeResult> {
  await requirePointTypesActor();

  const [existingRow] = await db.select({ id: pointTypes.id }).from(pointTypes).where(eq(pointTypes.id, id)).limit(1);
  if (!existingRow) return { ok: false, fieldErrors: { name: "notFound" } };

  const fieldErrors = await validatePointType(input, id);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(pointTypes)
    .set({ name: input.name.trim(), label: input.label.trim(), startDate: input.startDate, endDate: input.endDate })
    .where(eq(pointTypes.id, id));

  return { ok: true, id };
}

export type DeletePointTypeResult = { ok: true } | { ok: false; error: "notFound" };

export async function deletePointType(id: number): Promise<DeletePointTypeResult> {
  await requirePointTypesActor();

  const [existing] = await db.select({ id: pointTypes.id }).from(pointTypes).where(eq(pointTypes.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(pointTypes).where(eq(pointTypes.id, id));
  return { ok: true };
}

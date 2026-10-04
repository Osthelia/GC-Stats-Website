/**
 * GC-Stats - admin-sanctions
 *
 * Admin server actions for issuing sanctions against a user or team
 * (ban/warn types with a reason and validity window), with notification.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { sanctions, users, teams, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { SANCTION_TYPES, type SanctionType } from "@/lib/admin-sanctions";
import { notify } from "@/lib/notify";
import { parseIsoInstant } from "@/lib/datetime-local";

export type SanctionField = "target" | "type" | "reason" | "startsAt" | "endsAt";
export type SanctionFieldErrors = Partial<Record<SanctionField, string>>;
export type SanctionResult = { ok: true; id: number } | { ok: false; fieldErrors: SanctionFieldErrors };

export type SanctionInput = {
  userId: string | null;
  teamId: number | null;
  type: string;
  reason: string;
  startsAt: string;
  endsAt: string;
};

async function validateSanction(input: SanctionInput): Promise<SanctionFieldErrors> {
  const fieldErrors: SanctionFieldErrors = {};

  if (!input.userId && !input.teamId) fieldErrors.target = "required";
  if (input.userId) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!row) fieldErrors.target = "notFound";
  }
  if (input.teamId) {
    const [row] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, input.teamId)).limit(1);
    if (!row) fieldErrors.target = "notFound";
  }

  if (!(SANCTION_TYPES as readonly string[]).includes(input.type)) fieldErrors.type = "invalid";

  const reason = input.reason.trim();
  if (!reason) fieldErrors.reason = "required";
  else if (reason.length > 2000) fieldErrors.reason = "tooLong";

  const startsAt = input.startsAt ? parseIsoInstant(input.startsAt) : null;
  if (!input.startsAt) fieldErrors.startsAt = "required";
  else if (!startsAt) fieldErrors.startsAt = "invalid";

  if (input.endsAt) {
    const endsAt = parseIsoInstant(input.endsAt);
    if (!endsAt) fieldErrors.endsAt = "invalid";
    else if (startsAt && endsAt.getTime() <= startsAt.getTime()) fieldErrors.endsAt = "endBeforeStart";
  }

  return fieldErrors;
}

export async function createSanction(input: SanctionInput): Promise<SanctionResult> {
  const access = await requireActorPermission(PERMISSIONS.sanctionsManage);

  const fieldErrors = await validateSanction(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(sanctions)
    .values({
      userId: input.userId,
      teamId: input.teamId,
      issuedBy: access.userId,
      type: input.type as SanctionType,
      reason: input.reason.trim(),
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    })
    .returning({ id: sanctions.id });
  if (!created) throw new Error("Insert returned no row");

  // Notes are internal only, no notification, not visible to the sanctioned user (legal export excepted).
  if (input.userId && input.type !== "note") {
    await notify({
      recipientId: input.userId,
      type: "sanction.issued",
      authorId: access.userId,
      link: `/settings/sanctions/${created.id}`,
      data: { sanctionId: created.id, sanctionType: input.type },
    });
  }

  return { ok: true, id: created.id };
}

export type RevokeSanctionResult = { ok: true } | { ok: false; error: "notFound" | "alreadyRevoked" };

export async function revokeSanction(id: number): Promise<RevokeSanctionResult> {
  const access = await requireActorPermission(PERMISSIONS.sanctionsManage);

  const [existing] = await db.select({ id: sanctions.id, revokedAt: sanctions.revokedAt }).from(sanctions).where(eq(sanctions.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (existing.revokedAt) return { ok: false, error: "alreadyRevoked" };

  await db.update(sanctions).set({ revokedAt: new Date(), revokedBy: access.userId }).where(eq(sanctions.id, id));
  return { ok: true };
}

/**
 * GC-Stats - admin-pickem
 *
 * Admin server action toggling a stage's pick'em predictions on/off and
 * setting when predictions open.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { pickemStageSettings, stages, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { parseIsoInstant } from "@/lib/datetime-local";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

export type StagePickemSettingsInput = { enabled: boolean; opensAt: string | null };
export type StagePickemSettingsFieldErrors = Partial<Record<"opensAt", string>>;
export type StagePickemSettingsResult = { ok: true } | { ok: false; fieldErrors: StagePickemSettingsFieldErrors };

export async function updateStagePickemSettings(stageId: number, input: StagePickemSettingsInput): Promise<StagePickemSettingsResult> {
  await requireTournamentsActor();

  const [stage] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) return { ok: false, fieldErrors: { opensAt: "stageNotFound" } };

  const parsedOpensAt = input.opensAt ? parseIsoInstant(input.opensAt) : null;
  if (input.enabled && !input.opensAt) return { ok: false, fieldErrors: { opensAt: "required" } };
  if (input.opensAt && !parsedOpensAt) return { ok: false, fieldErrors: { opensAt: "invalid" } };

  const opensAt = parsedOpensAt ?? new Date();

  await db
    .insert(pickemStageSettings)
    .values({ stageId, enabled: input.enabled, opensAt })
    .onConflictDoUpdate({ target: pickemStageSettings.stageId, set: { enabled: input.enabled, opensAt } });

  return { ok: true };
}

/**
 * GC-Stats - admin-pickem
 *
 * Admin server action toggling a stage's pick'em predictions on/off, setting
 * when predictions open and how group containers are predicted.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { pickemStageSettings, pickemMatchPicks, pickemStandingPicks, stages, stageContainers, matches, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { parseIsoInstant } from "@/lib/datetime-local";

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

const GROUP_PICK_MODES = ["standings", "matches"] as const;
type GroupPickMode = (typeof GROUP_PICK_MODES)[number];

export type StagePickemSettingsInput = { enabled: boolean; opensAt: string | null; groupPickMode: GroupPickMode };
export type StagePickemSettingsFieldErrors = Partial<Record<"opensAt" | "groupPickMode", string>>;

/** Whether users already saved picks of the kind the other group mode would drop. */
async function hasPicksOfMode(stageId: number, mode: GroupPickMode): Promise<boolean> {
  if (mode === "standings") {
    const [row] = await db.select({ id: pickemStandingPicks.id }).from(pickemStandingPicks).where(eq(pickemStandingPicks.stageId, stageId)).limit(1);
    return !!row;
  }
  const groupMatchIds = db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .where(and(eq(stageContainers.stageId, stageId), eq(stageContainers.containerType, "group")));
  const [row] = await db.select({ id: pickemMatchPicks.id }).from(pickemMatchPicks).where(and(eq(pickemMatchPicks.stageId, stageId), inArray(pickemMatchPicks.matchId, groupMatchIds))).limit(1);
  return !!row;
}
export type StagePickemSettingsResult = { ok: true } | { ok: false; fieldErrors: StagePickemSettingsFieldErrors };

export async function updateStagePickemSettings(stageId: number, input: StagePickemSettingsInput): Promise<StagePickemSettingsResult> {
  await requireTournamentsActor();

  const [stage] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) return { ok: false, fieldErrors: { opensAt: "stageNotFound" } };

  const parsedOpensAt = input.opensAt ? parseIsoInstant(input.opensAt) : null;
  if (input.enabled && !input.opensAt) return { ok: false, fieldErrors: { opensAt: "required" } };
  if (input.opensAt && !parsedOpensAt) return { ok: false, fieldErrors: { opensAt: "invalid" } };

  if (!GROUP_PICK_MODES.includes(input.groupPickMode)) return { ok: false, fieldErrors: { groupPickMode: "invalid" } };

  const [current] = await db.select({ groupPickMode: pickemStageSettings.groupPickMode }).from(pickemStageSettings).where(eq(pickemStageSettings.stageId, stageId)).limit(1);
  const currentMode = current?.groupPickMode ?? "standings";
  // The field is only shown for stages with groups, any other stage keeps its mode.
  const [groupContainer] = await db
    .select({ id: stageContainers.id })
    .from(stageContainers)
    .where(and(eq(stageContainers.stageId, stageId), eq(stageContainers.containerType, "group")))
    .limit(1);
  const groupPickMode = groupContainer ? input.groupPickMode : currentMode;
  if (groupPickMode !== currentMode && (await hasPicksOfMode(stageId, currentMode))) return { ok: false, fieldErrors: { groupPickMode: "hasPicks" } };

  const opensAt = parsedOpensAt ?? new Date();

  await db
    .insert(pickemStageSettings)
    .values({ stageId, enabled: input.enabled, opensAt, groupPickMode })
    .onConflictDoUpdate({ target: pickemStageSettings.stageId, set: { enabled: input.enabled, opensAt, groupPickMode } });

  return { ok: true };
}

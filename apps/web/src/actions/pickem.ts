/**
 * GC-Stats - pickem
 *
 * Public-facing server actions for pick'em: submitting stage picks and
 * creating/joining prediction groups with a generated join code.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { pickemGroups, pickemGroupMembers, pickemGroupPhasePoints, tournaments, stages } from "@gc-stats/db";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveStagePicks, type SavePicksInput } from "@/lib/pickem/pickem-data";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

const GROUP_NAME_MAX_LENGTH = 100;
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, avoids ambiguous codes

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    const idx = crypto.randomInt(JOIN_CODE_ALPHABET.length);
    code += JOIN_CODE_ALPHABET[idx];
  }
  return code;
}

export async function submitStagePicks(stageId: number, input: SavePicksInput): Promise<ActionResult> {
  const userId = await requireUserId();
  const result = await saveStagePicks(userId, stageId, input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export type CreateGroupResult = ActionResult<{ id: number; joinCode: string }>;

export async function createPickemGroup(tournamentId: number, name: string): Promise<CreateGroupResult> {
  const userId = await requireUserId();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "nameRequired" };
  if (trimmed.length > GROUP_NAME_MAX_LENGTH) return { ok: false, error: "nameTooLong" };

  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { ok: false, error: "tournamentNotFound" };

  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select({ id: pickemGroups.id }).from(pickemGroups).where(eq(pickemGroups.joinCode, joinCode)).limit(1);
    if (!existing) break;
    joinCode = generateJoinCode();
  }

  const [created] = await db.insert(pickemGroups).values({ tournamentId, name: trimmed, ownerUserId: userId, joinCode }).returning({ id: pickemGroups.id });
  if (!created) throw new Error("Insert returned no row");

  await db.insert(pickemGroupMembers).values({ groupId: created.id, userId });

  return { ok: true, id: created.id, joinCode };
}

const JOIN_WINDOW_MS = 10 * 60_000;
const JOIN_MAX_ATTEMPTS = 10;

export type JoinGroupResult = ActionResult<{ groupId: number }>;

export async function joinPickemGroupByCode(code: string): Promise<JoinGroupResult> {
  const userId = await requireUserId();

  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "codeRequired" };

  // Codes are short: cap guesses so private groups can't be enumerated.
  if (!(await checkRateLimit(`pickem-join:${userId}`, JOIN_WINDOW_MS, JOIN_MAX_ATTEMPTS))) return { ok: false, error: "tooManyAttempts" };

  const [group] = await db.select({ id: pickemGroups.id }).from(pickemGroups).where(eq(pickemGroups.joinCode, normalized)).limit(1);
  if (!group) return { ok: false, error: "codeNotFound" };

  const [existing] = await db.select({ id: pickemGroupMembers.id }).from(pickemGroupMembers).where(and(eq(pickemGroupMembers.groupId, group.id), eq(pickemGroupMembers.userId, userId))).limit(1);
  if (existing) return { ok: false, error: "alreadyMember" };

  await db.insert(pickemGroupMembers).values({ groupId: group.id, userId });
  return { ok: true, groupId: group.id };
}

export async function leavePickemGroup(groupId: number): Promise<ActionResult> {
  const userId = await requireUserId();

  const [group] = await db.select({ ownerUserId: pickemGroups.ownerUserId }).from(pickemGroups).where(eq(pickemGroups.id, groupId)).limit(1);
  if (!group) return { ok: false, error: "notFound" };
  if (group.ownerUserId === userId) return { ok: false, error: "ownerCannotLeave" };

  await db.delete(pickemGroupMembers).where(and(eq(pickemGroupMembers.groupId, groupId), eq(pickemGroupMembers.userId, userId)));
  return { ok: true };
}

async function requireGroupOwner(groupId: number, userId: string): Promise<ActionResult<{ stageIds: number[] }>> {
  const [group] = await db.select({ ownerUserId: pickemGroups.ownerUserId, tournamentId: pickemGroups.tournamentId }).from(pickemGroups).where(eq(pickemGroups.id, groupId)).limit(1);
  if (!group) return { ok: false, error: "notFound" };
  if (group.ownerUserId !== userId) return { ok: false, error: "forbidden" };
  const stageRows = await db.select({ id: stages.id }).from(stages).where(eq(stages.tournamentId, group.tournamentId));
  return { ok: true, stageIds: stageRows.map((s) => s.id) };
}

export async function setGroupScoringMode(groupId: number, mode: "default" | "custom"): Promise<ActionResult> {
  const userId = await requireUserId();
  const check = await requireGroupOwner(groupId, userId);
  if (!check.ok) return check;

  await db.update(pickemGroups).set({ scoringMode: mode }).where(eq(pickemGroups.id, groupId));
  return { ok: true };
}

export type GroupPhasePointsInput = { teamCorrectPoints: number; outcomeCorrectPoints: number; advancementPerRoundPoints: number; standingRankPoints: number };
export type GroupPhasePointsFieldErrors = Partial<Record<keyof GroupPhasePointsInput, string>>;
export type SetGroupPhasePointsResult = { ok: true } | { ok: false; fieldErrors: GroupPhasePointsFieldErrors } | { ok: false; error: string };

function validatePhasePoints(input: GroupPhasePointsInput): GroupPhasePointsFieldErrors {
  const fieldErrors: GroupPhasePointsFieldErrors = {};
  for (const key of Object.keys(input) as (keyof GroupPhasePointsInput)[]) {
    const value = input[key];
    if (!Number.isInteger(value) || value < 0 || value > 1000) fieldErrors[key] = "invalid";
  }
  return fieldErrors;
}

export async function setGroupPhasePoints(groupId: number, stageId: number, input: GroupPhasePointsInput): Promise<SetGroupPhasePointsResult> {
  const userId = await requireUserId();
  const check = await requireGroupOwner(groupId, userId);
  if (!check.ok) return { ok: false, error: check.error };
  if (!check.stageIds.includes(stageId)) return { ok: false, error: "stageNotInTournament" };

  const fieldErrors = validatePhasePoints(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .insert(pickemGroupPhasePoints)
    .values({ groupId, stageId, ...input })
    .onConflictDoUpdate({ target: [pickemGroupPhasePoints.groupId, pickemGroupPhasePoints.stageId], set: input });

  return { ok: true };
}

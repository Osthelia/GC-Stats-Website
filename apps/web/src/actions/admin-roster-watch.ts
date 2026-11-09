/**
 * GC-Stats - admin-roster-watch
 *
 * Admin server actions of the roster watch: review a signal and manage the
 * followed X accounts. Every value is validated here, not only in the form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, groupEntries, matches, stageContainers, stages, teams, tournaments, xMonitoredAccounts, xRosterSignals, PERMISSIONS } from "@gc-stats/db";
import { searchTournamentsQuery, type TournamentPickerResult } from "@/lib/tournament-search";
import { requireActorPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { normalizeXHandle, planReview, type ReviewError, type ReviewInput } from "@/lib/roster-watch/review";
import { queueRosterWebhooks } from "@/lib/webhooks/roster";
import type { SignalStatus, Stage, Verdict } from "@/lib/roster-watch/constants";

export type ReviewSignalResult =
  | { ok: true; status: SignalStatus; teamId: number }
  | { ok: false; error: ReviewError | "notFound"; field?: "reviewTopic" | "reviewNote" };

export async function reviewRosterSignal(signalId: number, input: ReviewInput): Promise<ReviewSignalResult> {
  const access = await requireActorPermission(PERMISSIONS.rosterWatchManage);

  if (!Number.isInteger(signalId) || signalId <= 0) return { ok: false, error: "notFound" };
  const [signal] = await db
    .select({ id: xRosterSignals.id, teamId: xRosterSignals.teamId, stage: xRosterSignals.stage, verdict: xRosterSignals.verdict, status: xRosterSignals.status })
    .from(xRosterSignals)
    .where(eq(xRosterSignals.id, signalId))
    .limit(1);
  if (!signal) return { ok: false, error: "notFound" };

  const plan = planReview({ stage: signal.stage as Stage, verdict: signal.verdict as Verdict | null, status: signal.status as SignalStatus }, input);
  if (!plan.ok) return plan;

  // The status guard makes a double click or a concurrent review a no-op.
  const updated = await db
    .update(xRosterSignals)
    .set({ ...plan.patch, reviewedBy: access.userId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(xRosterSignals.id, signalId), eq(xRosterSignals.status, "pending")))
    .returning({ id: xRosterSignals.id });
  if (updated.length === 0) return { ok: false, error: "invalidState" };

  await logActivity({
    subject: "team",
    subjectId: signal.teamId,
    event: "updated",
    logName: "rosterWatch",
    description: `roster watch signal ${plan.patch.status}`,
    actorUserId: access.userId,
    properties: { signalId, status: plan.patch.status },
  });

  if (plan.patch.status === "team_edited") await queueValidatedSignal(signalId);

  return { ok: true, status: plan.patch.status, teamId: signal.teamId };
}

/** The review is already saved, a webhook problem must not fail it. */
async function queueValidatedSignal(signalId: number): Promise<void> {
  try {
    const [row] = await db
      .select({
        id: xRosterSignals.id,
        teamId: teams.id,
        teamName: teams.name,
        tweetUrl: xRosterSignals.tweetUrl,
        text: xRosterSignals.text,
        media: xRosterSignals.media,
        tweetedAt: xRosterSignals.tweetedAt,
        topic: xRosterSignals.topic,
        players: xRosterSignals.players,
      })
      .from(xRosterSignals)
      .innerJoin(teams, eq(teams.id, xRosterSignals.teamId))
      .where(eq(xRosterSignals.id, signalId))
      .limit(1);
    if (row) await queueRosterWebhooks({ ...row, validatedAt: new Date() });
  } catch (error) {
    console.error("[roster-watch] webhook queueing failed (signal #%d)", signalId, error);
  }
}

export type AccountResult =
  | { ok: true }
  | { ok: false; error: "notFound" | "teamRequired" | "teamNotFound" | "handleRequired" | "handleInvalid" | "handleTaken"; field?: "team" | "handle" };

export async function addMonitoredAccount(input: { teamId: number | null; handle: string }): Promise<AccountResult> {
  const access = await requireActorPermission(PERMISSIONS.rosterWatchManage);

  if (typeof input?.teamId !== "number" || !Number.isInteger(input.teamId) || input.teamId <= 0) return { ok: false, error: "teamRequired", field: "team" };
  const handle = normalizeXHandle(input.handle);
  if (!handle.ok) return { ok: false, error: handle.error, field: "handle" };

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, input.teamId)).limit(1);
  if (!team) return { ok: false, error: "teamNotFound", field: "team" };

  const [existing] = await db.select({ id: xMonitoredAccounts.id }).from(xMonitoredAccounts).where(sql`lower(${xMonitoredAccounts.xHandle}) = ${handle.handle}`).limit(1);
  if (existing) return { ok: false, error: "handleTaken", field: "handle" };

  const inserted = await db
    .insert(xMonitoredAccounts)
    .values({ teamId: team.id, xHandle: handle.handle })
    .onConflictDoNothing({ target: xMonitoredAccounts.xHandle })
    .returning({ id: xMonitoredAccounts.id });
  if (inserted.length === 0) return { ok: false, error: "handleTaken", field: "handle" };

  await logActivity({
    subject: "team",
    subjectId: team.id,
    event: "updated",
    logName: "rosterWatch",
    description: "roster watch account added",
    actorUserId: access.userId,
    properties: { handle: handle.handle },
  });
  return { ok: true };
}

export async function searchTournamentsForRosterWatch(query: string): Promise<TournamentPickerResult[]> {
  await requireActorPermission(PERMISSIONS.rosterWatchManage);
  return searchTournamentsQuery(typeof query === "string" ? query.slice(0, 100) : "");
}

export async function listTournamentStagesForRosterWatch(tournamentId: number): Promise<{ id: number; name: string }[]> {
  await requireActorPermission(PERMISSIONS.rosterWatchManage);
  if (!Number.isInteger(tournamentId) || tournamentId <= 0) return [];
  return db.select({ id: stages.id, name: stages.name }).from(stages).where(eq(stages.tournamentId, tournamentId)).orderBy(asc(stages.sequenceOrder), asc(stages.id));
}

export type ImportAccountsResult =
  | { ok: true; added: number; alreadyFollowed: number; noTwitter: number; invalid: number }
  | { ok: false; error: "tournamentRequired" | "tournamentNotFound" | "stageNotFound"; field: "tournament" | "stage" };

export async function importTournamentAccounts(input: { tournamentId: number | null; stageId: number | null }): Promise<ImportAccountsResult> {
  const access = await requireActorPermission(PERMISSIONS.rosterWatchManage);

  if (typeof input?.tournamentId !== "number" || !Number.isInteger(input.tournamentId) || input.tournamentId <= 0) return { ok: false, error: "tournamentRequired", field: "tournament" };
  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, input.tournamentId)).limit(1);
  if (!tournament) return { ok: false, error: "tournamentNotFound", field: "tournament" };

  // Undefined or null means the whole tournament.
  const stageId = input.stageId ?? null;
  if (stageId !== null) {
    if (typeof stageId !== "number" || !Number.isInteger(stageId)) return { ok: false, error: "stageNotFound", field: "stage" };
    const [stage] = await db.select({ id: stages.id }).from(stages).where(and(eq(stages.id, stageId), eq(stages.tournamentId, tournament.id))).limit(1);
    if (!stage) return { ok: false, error: "stageNotFound", field: "stage" };
  }

  const rows = await listImportableTeams(tournament.id, stageId);
  const followed = new Set((await db.select({ handle: xMonitoredAccounts.xHandle }).from(xMonitoredAccounts)).map((row) => row.handle.toLowerCase()));

  const toInsert: { teamId: number; xHandle: string }[] = [];
  let alreadyFollowed = 0;
  let noTwitter = 0;
  let invalid = 0;
  for (const row of rows) {
    const twitter = (row.socials as Record<string, unknown> | null)?.twitter;
    if (typeof twitter !== "string" || !twitter.trim()) {
      noTwitter++;
      continue;
    }
    const handle = normalizeXHandle(twitter);
    if (!handle.ok) {
      invalid++;
      continue;
    }
    if (followed.has(handle.handle)) {
      alreadyFollowed++;
      continue;
    }
    followed.add(handle.handle);
    toInsert.push({ teamId: row.teamId, xHandle: handle.handle });
  }

  const inserted = toInsert.length > 0 ? await db.insert(xMonitoredAccounts).values(toInsert).onConflictDoNothing({ target: xMonitoredAccounts.xHandle }).returning({ teamId: xMonitoredAccounts.teamId, handle: xMonitoredAccounts.xHandle }) : [];
  alreadyFollowed += toInsert.length - inserted.length;

  await logActivity({
    subject: "tournament",
    subjectId: tournament.id,
    event: "updated",
    logName: "tournament",
    description: "roster watch accounts imported",
    actorUserId: access.userId,
    properties: { stageId, handles: inserted.map((row) => row.handle) },
  });
  return { ok: true, added: inserted.length, alreadyFollowed, noTwitter, invalid };
}

/** Teams (not placeholders) taking part in the tournament, or in one of its stages through its groups and matches. */
async function listImportableTeams(tournamentId: number, stageId: number | null): Promise<{ teamId: number; socials: unknown }[]> {
  const base = db.selectDistinct({ teamId: teams.id, socials: teams.socials }).from(entrants).innerJoin(teams, eq(teams.id, entrants.teamId));
  if (stageId === null) return base.where(eq(entrants.tournamentId, tournamentId));

  const containerIds = db.select({ id: stageContainers.id }).from(stageContainers).where(eq(stageContainers.stageId, stageId));
  const inGroup = db.select({ id: groupEntries.entrantId }).from(groupEntries).where(inArray(groupEntries.containerId, containerIds));
  const inMatchA = db.select({ id: matches.entrantAId }).from(matches).where(and(inArray(matches.containerId, containerIds), isNotNull(matches.entrantAId)));
  const inMatchB = db.select({ id: matches.entrantBId }).from(matches).where(and(inArray(matches.containerId, containerIds), isNotNull(matches.entrantBId)));
  return base.where(and(eq(entrants.tournamentId, tournamentId), or(inArray(entrants.id, inGroup), inArray(entrants.id, inMatchA), inArray(entrants.id, inMatchB))));
}

export async function setMonitoredAccountEnabled(accountId: number, enabled: boolean): Promise<AccountResult> {
  const access = await requireActorPermission(PERMISSIONS.rosterWatchManage);

  if (!Number.isInteger(accountId) || accountId <= 0 || typeof enabled !== "boolean") return { ok: false, error: "notFound" };
  const [account] = await db
    .update(xMonitoredAccounts)
    .set({ enabled })
    .where(eq(xMonitoredAccounts.id, accountId))
    .returning({ teamId: xMonitoredAccounts.teamId, handle: xMonitoredAccounts.xHandle });
  if (!account) return { ok: false, error: "notFound" };

  await logActivity({
    subject: "team",
    subjectId: account.teamId,
    event: "updated",
    logName: "rosterWatch",
    description: enabled ? "roster watch account enabled" : "roster watch account disabled",
    actorUserId: access.userId,
    properties: { handle: account.handle },
  });
  return { ok: true };
}

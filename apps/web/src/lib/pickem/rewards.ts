/**
 * GC-Stats - rewards
 *
 * Computes and stores permanent pick'em reward badges (top 1%, top 5%,
 * perfect bracket) once a stage completes, based on the public leaderboard.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { pickemStageSettings, pickemRewards, stages, tournaments, groupEntries, users } from "@gc-stats/db";
import { slugify } from "@/lib/entity-id";
import { getStageEditorData } from "@/lib/admin-bracket-editor-data";
import { computeStageLeaderboard } from "./pickem-data";
import { DEFAULT_PICKEM_SCORING } from "./scoring";

/**
 * Rewards are a permanent snapshot of a completed phase's PUBLIC (default
 * scoring) leaderboard — never a custom group's, so a badge always means
 * the same thing regardless of which group someone picked in. Computed
 * lazily the first time anyone views the stage's results after it
 * completes (mirrors `computeContainerStandings` being read-time rather
 * than a cron job), then never recomputed — a row already existing for the
 * stage is the "done" marker.
 */
export async function ensureStageRewardsComputed(stageId: number): Promise<void> {
  const [stage] = await db.select({ id: stages.id, status: stages.status }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage || stage.status !== "completed") return;

  const [settings] = await db.select({ enabled: pickemStageSettings.enabled }).from(pickemStageSettings).where(eq(pickemStageSettings.stageId, stageId)).limit(1);
  if (!settings?.enabled) return;

  const [existing] = await db.select({ id: pickemRewards.id }).from(pickemRewards).where(eq(pickemRewards.stageId, stageId)).limit(1);
  if (existing) return;

  const editorData = await getStageEditorData(stageId);
  if (!editorData) return;

  const totalBracketMatches = editorData.matches.filter((m) => editorData.containers.find((c) => c.id === m.containerId)?.containerType === "bracket").length;
  const groupContainerIds = editorData.containers.filter((c) => c.containerType === "group").map((c) => c.id);
  const totalStandingEntrants = groupContainerIds.length
    ? (await db.select({ containerId: groupEntries.containerId }).from(groupEntries).where(inArray(groupEntries.containerId, groupContainerIds))).length
    : 0;
  const hasAnyPickable = totalBracketMatches > 0 || totalStandingEntrants > 0;

  const leaderboard = await computeStageLeaderboard(stageId, DEFAULT_PICKEM_SCORING);
  if (leaderboard.length === 0) return;

  const total = leaderboard.length;
  const top1Count = Math.max(1, Math.ceil(total * 0.01));
  const top5Count = Math.max(1, Math.ceil(total * 0.05));

  const rows: { userId: string; stageId: number; kind: "top1pct" | "top5pct" | "perfect" }[] = [];
  for (const entry of leaderboard) {
    const rank = 1 + leaderboard.filter((e) => e.score > entry.score).length;
    if (rank <= top1Count) rows.push({ userId: entry.userId, stageId, kind: "top1pct" });
    else if (rank <= top5Count) rows.push({ userId: entry.userId, stageId, kind: "top5pct" });

    const isPerfect =
      hasAnyPickable &&
      entry.totalMatchPicks === totalBracketMatches &&
      entry.correctMatchPicks === totalBracketMatches &&
      entry.totalStandingPicks === totalStandingEntrants &&
      entry.correctStandingPicks === totalStandingEntrants;
    if (isPerfect) rows.push({ userId: entry.userId, stageId, kind: "perfect" });
  }

  if (rows.length > 0) {
    await db.insert(pickemRewards).values(rows).onConflictDoNothing();
  }
}

/** Self-contained rewards for display OUTSIDE a stage's own page (e.g. a user's public profile) — each row carries the tournament/phase name it was earned for, since that context isn't implicit there. */
export type UserRewardRow = { kind: "top1pct" | "top5pct" | "perfect"; tournamentId: number; tournamentName: string; tournamentHref: string; stageName: string; awardedAt: string };

export async function getUserRewards(userId: string): Promise<UserRewardRow[]> {
  const rows = await db
    .select({ kind: pickemRewards.kind, awardedAt: pickemRewards.awardedAt, stageName: stages.name, tournamentId: tournaments.id, tournamentName: tournaments.name })
    .from(pickemRewards)
    .innerJoin(stages, eq(stages.id, pickemRewards.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(pickemRewards.userId, userId));

  return rows
    .map((r) => ({ ...r, awardedAt: r.awardedAt.toISOString(), tournamentHref: `/tournaments/${r.tournamentId}/${slugify(r.tournamentName)}` }))
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));
}

export type StageRewardRow = { userId: string; username: string | null; kind: "top1pct" | "top5pct" | "perfect" };

export async function getStageRewards(stageId: number): Promise<StageRewardRow[]> {
  const rows = await db
    .select({ userId: pickemRewards.userId, kind: pickemRewards.kind, username: users.username })
    .from(pickemRewards)
    .innerJoin(users, eq(users.id, pickemRewards.userId))
    .where(eq(pickemRewards.stageId, stageId));
  return rows;
}

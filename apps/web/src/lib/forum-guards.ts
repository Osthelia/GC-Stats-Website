/**
 * GC-Stats - forum-guards
 *
 * Permission and rate limit checks for forum writes: active sanctions, rules
 * acceptance, thread/message/report rate limits, and issuing automod mutes.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { adminDb, db } from "@gc-stats/db/client";
import { forumMessages, forumThreads, sanctions, userReports, users } from "@gc-stats/db";
import { ADMIN_ACCESS_PERMISSION, getGlobalAccess, hasAccess } from "@/lib/rbac";
import { notify } from "@/lib/notify";

const THREAD_CREATE_LIMIT = 3;
const THREAD_CREATE_WINDOW_MS = 10 * 60 * 1000;
const MESSAGE_POST_LIMIT = 5;
const MESSAGE_POST_WINDOW_MS = 30 * 1000;
const REPORT_LIMIT = 15;
const REPORT_WINDOW_MS = 60 * 60 * 1000;
const AUTOMOD_MUTE_DURATION_MS = 6 * 60 * 60 * 1000;
const AUTOMOD_MUTE_FLAG_INTERVAL = 3;

export type PostGuardError = "blocked" | "muted" | "rulesNotAccepted";

/** A blocking sanction (suspension/ban) stops everything; a mute only stops posting (both global with team_id null, never revoked, still within their window). */
async function activeGlobalSanction(userId: string, types: string[]) {
  const now = new Date();
  const [row] = await db
    .select({ id: sanctions.id })
    .from(sanctions)
    .where(
      and(
        eq(sanctions.userId, userId),
        isNull(sanctions.teamId),
        isNull(sanctions.revokedAt),
        or(...types.map((t) => eq(sanctions.type, t))),
        sql`${sanctions.startsAt} <= ${now}`,
        or(isNull(sanctions.endsAt), gt(sanctions.endsAt, now))
      )
    )
    .limit(1);
  return !!row;
}

/**
 * Guards every forum write (thread/reply, rules acceptance excluded since that
 * one only needs auth). Returns null when the user may post, otherwise the
 * first blocking reason found, checked in the same order V1 aborts on them.
 */
export async function assertCanPostToForum(userId: string): Promise<PostGuardError | null> {
  if (await activeGlobalSanction(userId, ["suspension", "ban"])) return "blocked";
  if (await activeGlobalSanction(userId, ["mute"])) return "muted";

  // adminDb (caching disabled): a just-accepted rules row must be visible on the very next post attempt.
  const [user] = await adminDb.select({ forumRulesAcceptedAt: users.forumRulesAcceptedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.forumRulesAcceptedAt) return "rulesNotAccepted";

  return null;
}

/** Thread creation: N per window, proxied by the opening message (thread itself has no createdAt, see schema/content.ts forumThreads). */
export async function canCreateThread(userId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - THREAD_CREATE_WINDOW_MS);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(forumMessages)
    .innerJoin(forumThreads, eq(forumThreads.id, forumMessages.threadId))
    .where(
      and(
        eq(forumMessages.userId, userId),
        isNull(forumMessages.parentId),
        eq(forumThreads.category, "general"),
        gt(forumMessages.createdAt, cutoff)
      )
    );
  return (row?.count ?? 0) < THREAD_CREATE_LIMIT;
}

export async function canPostMessage(userId: string, threadId: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - MESSAGE_POST_WINDOW_MS);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(forumMessages)
    .where(and(eq(forumMessages.userId, userId), eq(forumMessages.threadId, threadId), gt(forumMessages.createdAt, cutoff)));
  return (row?.count ?? 0) < MESSAGE_POST_LIMIT;
}

export async function canSubmitReport(userId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - REPORT_WINDOW_MS);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userReports)
    .where(and(eq(userReports.reporterId, userId), gt(userReports.createdAt, cutoff)));
  return (row?.count ?? 0) < REPORT_LIMIT;
}

/** System-issued mute from automod (never mutes staff, never stacks on an existing mute). Mirrors V1's SanctionService::issueSystemMute. */
export async function issueAutomodMute(userId: string, reason: string): Promise<void> {
  const access = await getGlobalAccess(userId);
  if (hasAccess(access, ADMIN_ACCESS_PERMISSION)) return;
  if (await activeGlobalSanction(userId, ["mute"])) return;

  const [created] = await db
    .insert(sanctions)
    .values({
      userId,
      issuedBy: null,
      type: "mute",
      reason,
      endsAt: new Date(Date.now() + AUTOMOD_MUTE_DURATION_MS),
    })
    .returning({ id: sanctions.id });

  await notify({ recipientId: userId, type: "sanction.issued", authorId: null, link: `/settings/sanctions/${created!.id}`, data: { sanctionId: created!.id, sanctionType: "mute" } });
}

export { AUTOMOD_MUTE_FLAG_INTERVAL };

export type ForumPostStatus = "guest" | "blocked" | "muted" | "rulesNotAccepted" | "ok";

/** Same checks as assertCanPostToForum, resolved to a status the page can render a gate for (see components/forum/forum-post-gate.tsx) instead of only surfacing on submit. */
export async function getForumPostStatus(userId: string | null | undefined): Promise<ForumPostStatus> {
  if (!userId) return "guest";
  const error = await assertCanPostToForum(userId);
  return error ?? "ok";
}

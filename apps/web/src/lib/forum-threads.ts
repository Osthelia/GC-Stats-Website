/**
 * GC-Stats - forum-threads
 *
 * Attaches a forum thread to a match/news article/tournament (category =
 * subject type), lazily created on first view and embedded directly on that
 * page rather than a separate standalone route (see
 * components/forum/forum-thread-panel.tsx).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { forumThreads } from "@gc-stats/db";

export const LINKED_THREAD_SUBJECT_TYPES = ["match", "news", "tournament"] as const;
export type LinkedThreadSubjectType = (typeof LINKED_THREAD_SUBJECT_TYPES)[number];

/** Read first so a page view doesn't write; the insert is race-safe via the unique (subject_type, subject_id) constraint. */
export async function findOrCreateThreadFor(subjectType: LinkedThreadSubjectType, subjectId: number): Promise<number> {
  const findExisting = async () => {
    const [existing] = await db
      .select({ id: forumThreads.id })
      .from(forumThreads)
      .where(and(eq(forumThreads.subjectType, subjectType), eq(forumThreads.subjectId, subjectId)))
      .limit(1);
    return existing?.id;
  };

  const existingId = await findExisting();
  if (existingId !== undefined) return existingId;

  const [inserted] = await db
    .insert(forumThreads)
    .values({ category: subjectType, subjectType, subjectId })
    .onConflictDoNothing({ target: [forumThreads.subjectType, forumThreads.subjectId] })
    .returning({ id: forumThreads.id });
  if (inserted) return inserted.id;

  return (await findExisting())!;
}

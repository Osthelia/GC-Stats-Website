/**
 * GC-Stats - forum-mentions
 *
 * Extracts `@name` mentions from a forum message body and resolves them to
 * real user accounts, for mention notifications.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ilike, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";

// Same charset as lib/user-profile-validation.ts USERNAME_RE.
const MENTION_PATTERN = /@([a-zA-Z0-9_-]{3,32})/g;

/** Distinct candidate usernames referenced with `@name` in a message body, lowercased for a case-insensitive lookup. */
export function extractMentionedUsernames(body: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(MENTION_PATTERN)) names.add(match[1]!.toLowerCase());
  return [...names];
}

/** Resolves `@name` mentions to real accounts, excluding a set of user ids (the author, and anyone already notified some other way for this message). */
export async function resolveMentionedUserIds(body: string, excludeUserIds: Set<string>): Promise<string[]> {
  const names = extractMentionedUsernames(body);
  if (names.length === 0) return [];

  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(or(...names.map((n) => ilike(users.username, n))));

  return rows.filter((r) => !excludeUserIds.has(r.id)).map((r) => r.id);
}

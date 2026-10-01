/**
 * GC-Stats - user-search
 *
 * Typo tolerant account search backing the shared UserPicker component.
 * Used by both admin player linking and organization membership flows,
 * which apply their own permission checks around this same query.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ilike, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";

export type UserPickerResult = { id: string; username: string | null; email: string | null };

/**
 * Typo-tolerant account search backing UserPicker. Shared by
 * actions/admin-players.ts (searchUsersForLink, admin-gated — the player
 * "linked account" flow, also the default UserPicker uses everywhere in
 * /admin including the organization dashboard-access panel) and
 * actions/dashboard-organizations.ts (searchUsersForOrganization,
 * org-membership-gated instead) — same query, different callers'
 * permission checks.
 */
export async function searchUsersQuery(query: string): Promise<UserPickerResult[]> {
  const q = query.trim();
  if (!q) {
    return db.select({ id: users.id, username: users.username, email: users.email }).from(users).orderBy(users.username).limit(8);
  }

  const variants = typoVariants(q.toLowerCase());
  const clauses = variants.map((v) => foldedIlike(users.username, v));
  clauses.push(ilike(users.email, `%${q}%`));

  return db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(or(...clauses))
    .orderBy(users.username)
    .limit(8);
}

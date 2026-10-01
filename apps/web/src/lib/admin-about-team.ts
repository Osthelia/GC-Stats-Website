/**
 * GC-Stats - admin-about-team
 *
 * Admin queries for the /about team roster: category list and the full
 * admin-editable member population, unfiltered by visibility.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, and, isNull, asc } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, roles, userRoles, aboutTeamCategories, aboutTeamMemberSettings } from "@gc-stats/db";

export type AboutTeamCategoryRow = {
  id: number;
  key: string;
  label: Record<string, string>;
  order: number;
};

export async function listAboutTeamCategories(): Promise<AboutTeamCategoryRow[]> {
  const rows = await db.select().from(aboutTeamCategories).orderBy(asc(aboutTeamCategories.order), asc(aboutTeamCategories.id));
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: (r.label as Record<string, string>) ?? {},
    order: r.order,
  }));
}

export type AboutTeamMemberRow = {
  userId: string;
  username: string;
  name: string | null;
  image: string | null;
  roleNames: string[];
  categoryId: number | null;
  displayRole: Record<string, string> | null;
  isVisible: boolean;
  order: number;
};

/** Every user with a global role, joined with their (optional) display settings — the full admin-editable population, unfiltered by visibility. */
export async function listAboutTeamMembersAdmin(): Promise<AboutTeamMemberRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      image: users.image,
      roleName: roles.name,
      categoryId: aboutTeamMemberSettings.categoryId,
      displayRole: aboutTeamMemberSettings.displayRole,
      isVisible: aboutTeamMemberSettings.isVisible,
      memberOrder: aboutTeamMemberSettings.order,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .leftJoin(aboutTeamMemberSettings, eq(aboutTeamMemberSettings.userId, users.id))
    .where(and(eq(roles.scopeType, "global"), isNull(userRoles.scopeId)))
    .orderBy(asc(users.name));

  const byUser = new Map<string, AboutTeamMemberRow>();
  for (const row of rows) {
    if (!row.username) continue;
    let member = byUser.get(row.userId);
    if (!member) {
      member = {
        userId: row.userId,
        username: row.username,
        name: row.name,
        image: row.image,
        roleNames: [],
        categoryId: row.categoryId,
        displayRole: (row.displayRole as Record<string, string> | null) ?? null,
        isVisible: row.isVisible ?? true,
        order: row.memberOrder ?? 0,
      };
      byUser.set(row.userId, member);
    }
    member.roleNames.push(row.roleName);
  }
  return [...byUser.values()].sort((a, b) => (a.name ?? a.username).localeCompare(b.name ?? b.username));
}

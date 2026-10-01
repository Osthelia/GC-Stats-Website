/**
 * GC-Stats - about-data
 *
 * Builds the public /about team roster from users holding a global role,
 * layered with admin-editable visibility, display role and category
 * overrides.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, and, isNull, asc } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users, roles, userRoles, aboutTeamMemberSettings, aboutTeamCategories } from "@gc-stats/db";

export type AboutTeamMember = {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  socials: Record<string, string>;
  roleNames: string[];
  displayRole: Record<string, string> | null;
  category: { key: string; label: Record<string, string>; order: number } | null;
  order: number;
};

/**
 * The "team" shown on /about is every user holding a global (not org- or
 * team-scoped) role — mirrors V1's Public\AboutController::team(), which
 * read the same population (site staff) directly off the raw role pivot.
 * Visibility, display role and category are admin-editable overrides layered
 * on top of that automatic population (about_team_member_settings), absence
 * of a settings row means "visible, uncategorized, default role names".
 */
export async function getAboutTeam(): Promise<AboutTeamMember[]> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      image: users.image,
      bio: users.bio,
      socials: users.socials,
      roleName: roles.name,
      isVisible: aboutTeamMemberSettings.isVisible,
      displayRole: aboutTeamMemberSettings.displayRole,
      memberOrder: aboutTeamMemberSettings.order,
      categoryKey: aboutTeamCategories.key,
      categoryLabel: aboutTeamCategories.label,
      categoryOrder: aboutTeamCategories.order,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .leftJoin(aboutTeamMemberSettings, eq(aboutTeamMemberSettings.userId, users.id))
    .leftJoin(aboutTeamCategories, eq(aboutTeamCategories.id, aboutTeamMemberSettings.categoryId))
    .where(and(eq(roles.scopeType, "global"), isNull(userRoles.scopeId)))
    .orderBy(asc(users.name));

  const byUser = new Map<string, AboutTeamMember>();
  for (const row of rows) {
    if (!row.username) continue; // incomplete signup (no username yet), not shown publicly
    if (row.isVisible === false) continue;
    let member = byUser.get(row.userId);
    if (!member) {
      member = {
        id: row.userId,
        username: row.username,
        name: row.name,
        image: row.image,
        bio: row.bio,
        socials: (row.socials as Record<string, string>) ?? {},
        roleNames: [],
        displayRole: (row.displayRole as Record<string, string> | null) ?? null,
        category: row.categoryKey
          ? { key: row.categoryKey, label: (row.categoryLabel as Record<string, string>) ?? {}, order: row.categoryOrder ?? 0 }
          : null,
        order: row.memberOrder ?? 0,
      };
      byUser.set(row.userId, member);
    }
    member.roleNames.push(row.roleName);
  }
  return [...byUser.values()].sort((a, b) => {
    // Uncategorized members sort after every category, mirroring "no category" reading as least specific.
    const catOrderA = a.category ? a.category.order : Number.MAX_SAFE_INTEGER;
    const catOrderB = b.category ? b.category.order : Number.MAX_SAFE_INTEGER;
    if (catOrderA !== catOrderB) return catOrderA - catOrderB;
    if (a.order !== b.order) return a.order - b.order;
    return (a.name ?? a.username).localeCompare(b.name ?? b.username);
  });
}

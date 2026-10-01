/**
 * GC-Stats - admin-user-detail
 *
 * Admin queries for a user's detail page: profile, linked player, dashboard
 * organization access, sanctions, reports, and auth methods.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, roles, userRoles, accounts, authenticators, sessions, people, teams, sanctions, userReports, organizationAccess, organizations, organizationAccessRoles, organizationRoles } from "@gc-stats/db";
import type { AdminUserRole } from "@/lib/admin-users";
import { getAdminPlayerTeamHistory } from "@/lib/admin-players";
import { statusOf, type SanctionStatus, type SanctionType } from "@/lib/admin-sanctions";
import type { ReportStatus } from "@/lib/admin-reports";

export type AdminUserProfile = {
  id: string;
  username: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  socials: Record<string, string>;
  createdAt: Date;
  lastLoginAt: Date | null;
  isAuthor: boolean;
  roles: AdminUserRole[];
};

export type AdminUserAuthMethods = {
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  oauthAccounts: { provider: string }[];
  passkeyCount: number;
  activeSessionCount: number;
};

export async function getAdminUserProfile(userId: string): Promise<AdminUserProfile | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      image: users.image,
      bio: users.bio,
      socials: users.socials,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      isAuthor: users.isAuthor,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;

  const roleRows = await db
    .select({ id: roles.id, name: roles.name, isSuperAdmin: roles.isSuperAdmin })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(roles.scopeType, "global"), isNull(userRoles.scopeId)));

  return { ...row, socials: (row.socials as Record<string, string>) ?? {}, roles: roleRows };
}

export type AdminUserLinkedPlayer = {
  id: number;
  handle: string;
  currentTeams: { id: number; name: string }[];
};

/** Mirrors V1's admin user detail "linked player" section — reuses the same team-history query the player page itself uses, filtered to open stints. */
export async function getAdminUserLinkedPlayer(userId: string): Promise<AdminUserLinkedPlayer | null> {
  const [person] = await db.select({ id: people.id, handle: people.handle }).from(people).where(eq(people.userId, userId)).limit(1);
  if (!person) return null;

  const history = await getAdminPlayerTeamHistory(person.id);
  const currentTeams = history.filter((h) => h.isCurrent).map((h) => ({ id: h.teamId, name: h.teamName }));
  return { id: person.id, handle: person.handle, currentTeams };
}

export type AdminUserOrganizationRow = {
  id: number;
  name: string;
  slug: string;
  isOwner: boolean;
  roleNames: string[];
};

/** "Voir les orgs de l'user" — dashboard access (organization_access), not the public roster credit (organization_memberships). */
export async function getAdminUserOrganizations(userId: string): Promise<AdminUserOrganizationRow[]> {
  const accessRows = await db
    .select({ accessId: organizationAccess.id, id: organizations.id, name: organizations.name, slug: organizations.slug, isOwner: organizationAccess.isOwner })
    .from(organizationAccess)
    .innerJoin(organizations, eq(organizations.id, organizationAccess.organizationId))
    .where(eq(organizationAccess.userId, userId));
  if (accessRows.length === 0) return [];

  const accessIds = accessRows.map((r) => r.accessId);
  const roleRows = await db
    .select({ accessId: organizationAccessRoles.accessId, roleName: organizationRoles.name })
    .from(organizationAccessRoles)
    .innerJoin(organizationRoles, eq(organizationRoles.id, organizationAccessRoles.roleId))
    .where(inArray(organizationAccessRoles.accessId, accessIds));

  return accessRows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    isOwner: r.isOwner,
    roleNames: roleRows.filter((rr) => rr.accessId === r.accessId).map((rr) => rr.roleName),
  }));
}

export type AdminUserSanctionRow = {
  id: number;
  teamId: number | null;
  teamName: string | null;
  type: SanctionType;
  reason: string;
  endsAt: string | null;
  status: SanctionStatus;
};

export async function listUserSanctions(userId: string, limit = 15): Promise<AdminUserSanctionRow[]> {
  const rows = await db
    .select({ id: sanctions.id, teamId: sanctions.teamId, teamName: teams.name, type: sanctions.type, reason: sanctions.reason, endsAt: sanctions.endsAt, revokedAt: sanctions.revokedAt })
    .from(sanctions)
    .leftJoin(teams, eq(teams.id, sanctions.teamId))
    .where(eq(sanctions.userId, userId))
    .orderBy(desc(sanctions.id))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    teamId: r.teamId,
    teamName: r.teamName,
    type: r.type as SanctionType,
    reason: r.reason,
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    status: statusOf(r),
  }));
}

export type AdminUserReportReceivedRow = { id: number; category: string; reason: string; status: ReportStatus };
export type AdminUserReportSubmittedRow = { id: number; category: string; reason: string; status: ReportStatus; reportedUsername: string | null };

export async function listUserReportsReceived(userId: string, limit = 15): Promise<AdminUserReportReceivedRow[]> {
  return db
    .select({ id: userReports.id, category: userReports.category, reason: userReports.reason, status: userReports.status })
    .from(userReports)
    .where(eq(userReports.reportedUserId, userId))
    .orderBy(desc(userReports.id))
    .limit(limit) as Promise<AdminUserReportReceivedRow[]>;
}

export async function listUserReportsSubmitted(userId: string, limit = 15): Promise<AdminUserReportSubmittedRow[]> {
  const rows = await db
    .select({ id: userReports.id, category: userReports.category, reason: userReports.reason, status: userReports.status, reportedUsername: users.username })
    .from(userReports)
    .leftJoin(users, eq(users.id, userReports.reportedUserId))
    .where(eq(userReports.reporterId, userId))
    .orderBy(desc(userReports.id))
    .limit(limit);
  return rows as AdminUserReportSubmittedRow[];
}

export async function getAdminUserAuthMethods(userId: string): Promise<AdminUserAuthMethods> {
  const [[user], oauthRows, passkeyCountRows, activeSessionCountRows] = await Promise.all([
    db.select({ passwordHash: users.passwordHash, twoFactorConfirmedAt: users.twoFactorConfirmedAt }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ passkeyCount: count() }).from(authenticators).where(eq(authenticators.userId, userId)),
    db.select({ activeSessionCount: count() }).from(sessions).where(eq(sessions.userId, userId)),
  ]);

  return {
    hasPassword: !!user?.passwordHash,
    twoFactorEnabled: !!user?.twoFactorConfirmedAt,
    oauthAccounts: oauthRows,
    passkeyCount: Number(passkeyCountRows[0]?.passkeyCount ?? 0),
    activeSessionCount: Number(activeSessionCountRows[0]?.activeSessionCount ?? 0),
  };
}


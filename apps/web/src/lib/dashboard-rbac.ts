/**
 * GC-Stats - dashboard-rbac
 *
 * Resolves a user's organization memberships and permissions for the
 * dashboard, combining role-based grants with global admin overrides.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { organizations, organizationAccess, organizationAccessRoles, organizationRoles, organizationRolePermissions, users, apiKeys, ORGANIZATION_PERMISSIONS, PERMISSIONS } from "@gc-stats/db";
import { getSession } from "@/lib/session";
import { redirect } from "@/i18n/navigation";
import { getGlobalAccess, hasAccess } from "@/lib/rbac";
import type { AppLocale } from "@/i18n/routing";

export type DashboardOrgMembership = {
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  /** Display name only — "Owner" (i18n'd by the caller, see admin.organizations.edit.role.owner) for the sentinel, otherwise this organization's own free-text role name(s), comma-joined when the grant holds several. */
  roleName: string;
  isOwner: boolean;
  /** Ceiling-capped: 'owner' gets the whole organizations.max_permissions ceiling, any other grant gets the union of all its roles' organization_role_permissions ∩ that same ceiling. */
  permissions: Set<string>;
  /** True only for the synthetic entry a site admin (see getGlobalOrgAdminMemberships) gets for an organization it holds no real organization_access row for — never persisted. */
  isGlobalAdminOverride?: boolean;
};

export type DashboardAccess = {
  userId: string;
  memberships: DashboardOrgMembership[];
  /** Individual news-authoring grant (users.is_author), independent of any organization — see /dashboard/author. */
  isAuthor: boolean;
  /** Owns at least one personal API key (api_key.user_id), independent of any organization — see /dashboard/api-keys. Same idea as isAuthor: having the key is the grant, no separate permission to hold. */
  hasApiKey: boolean;
};

async function getIsAuthor(userId: string): Promise<boolean> {
  const [row] = await db.select({ isAuthor: users.isAuthor }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.isAuthor ?? false;
}

async function getHasPersonalApiKey(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: apiKeys.id }).from(apiKeys).where(eq(apiKeys.userId, userId)).limit(1);
  return !!row;
}

/**
 * Every organization this ACCOUNT has been granted dashboard access to
 * (organization_access, keyed on users.id — never on people/
 * organization_memberships, which is a separate public credit roster, see
 * schema/people.ts), each with the permission set that role grants for that
 * one organization. "Individual media" accounts are not a separate concept
 * — they're an organization with a single access grant (role_id NULL, i.e.
 * 'owner'), same as any other; see SUIVI.MD.
 */
export async function getDashboardMemberships(userId: string): Promise<DashboardOrgMembership[]> {
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      maxPermissions: organizations.maxPermissions,
      accessId: organizationAccess.id,
      isOwner: organizationAccess.isOwner,
    })
    .from(organizationAccess)
    .innerJoin(organizations, eq(organizations.id, organizationAccess.organizationId))
    .where(eq(organizationAccess.userId, userId));

  if (rows.length === 0) return [];

  const accessIds = rows.map((r) => r.accessId);
  const roleRows = await db
    .select({ accessId: organizationAccessRoles.accessId, roleId: organizationAccessRoles.roleId, roleName: organizationRoles.name })
    .from(organizationAccessRoles)
    .innerJoin(organizationRoles, eq(organizationRoles.id, organizationAccessRoles.roleId))
    .where(inArray(organizationAccessRoles.accessId, accessIds));

  const roleIds = [...new Set(roleRows.map((r) => r.roleId))];
  const permRows =
    roleIds.length === 0
      ? []
      : await db
          .select({ roleId: organizationRolePermissions.roleId, permission: organizationRolePermissions.permission })
          .from(organizationRolePermissions)
          .where(inArray(organizationRolePermissions.roleId, roleIds));

  return rows.map((r) => {
    const ceiling = new Set<string>(Array.isArray(r.maxPermissions) ? (r.maxPermissions as string[]) : []);
    const myRoles = roleRows.filter((rr) => rr.accessId === r.accessId);
    const granted = r.isOwner
      ? ceiling
      : new Set(permRows.filter((pr) => myRoles.some((mr) => mr.roleId === pr.roleId)).map((pr) => pr.permission).filter((p) => ceiling.has(p)));
    return {
      organizationId: r.organizationId,
      organizationName: r.organizationName,
      organizationSlug: r.organizationSlug,
      roleName: r.isOwner ? "owner" : (myRoles.map((mr) => mr.roleName).join(", ") || "-"),
      isOwner: r.isOwner,
      permissions: granted,
    };
  });
}

export function hasOrgPermission(membership: DashboardOrgMembership, permission: string): boolean {
  return membership.permissions.has(permission);
}

/** True for a site admin who can jump into any organization's dashboard from /dashboard without an organization_access row (see getGlobalOrgAdminMemberships) — same gate as /admin/organizations' own access-granting panel (organizationsManageAccess), so nothing here grants an admin more than they could already give themselves manually. */
async function hasGlobalOrgOverride(userId: string): Promise<boolean> {
  const globalAccess = await getGlobalAccess(userId);
  return hasAccess(globalAccess, PERMISSIONS.organizationsManageAccess);
}

/**
 * Every organization, synthesized as an owner-equivalent membership, for a
 * site admin holding the global override — lets them see and manage any
 * organization from /dashboard/{id} without a real organization_access row.
 * Kept separate from getDashboardMemberships (real grants only): other
 * checks built on that function (e.g. requireNewsWriterAccess's "can write
 * for an org" test) must keep reflecting real grants, not this override.
 */
async function getGlobalOrgAdminMemberships(userId: string): Promise<DashboardOrgMembership[]> {
  if (!(await hasGlobalOrgOverride(userId))) return [];

  const rows = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, maxPermissions: organizations.maxPermissions }).from(organizations);
  return rows.map((r) => ({
    organizationId: r.id,
    organizationName: r.name,
    organizationSlug: r.slug,
    roleName: "admin",
    isOwner: true,
    isGlobalAdminOverride: true,
    permissions: new Set<string>(Array.isArray(r.maxPermissions) ? (r.maxPermissions as string[]) : []),
  }));
}

/** Real memberships plus the global admin override for every other organization — used everywhere /dashboard resolves "which organizations can this account reach" (picker, sidebar, org switcher, per-org access checks). A real membership always wins over the synthetic one for the same organization. */
async function getCombinedDashboardMemberships(userId: string): Promise<DashboardOrgMembership[]> {
  const [real, adminOverride] = await Promise.all([getDashboardMemberships(userId), getGlobalOrgAdminMemberships(userId)]);
  const realIds = new Set(real.map((m) => m.organizationId));
  return [...real, ...adminOverride.filter((m) => !realIds.has(m.organizationId))];
}

/** Cheap "should the nav show the dashboard link" check — same grants as requireDashboardAccess (organization_access, isAuthor, a personal API key, or the global admin override), no permission detail needed. */
export async function hasDashboardAccess(userId: string): Promise<boolean> {
  const [memberships, isAuthor, hasApiKey, isGlobalOrgAdmin] = await Promise.all([
    getDashboardMemberships(userId),
    getIsAuthor(userId),
    getHasPersonalApiKey(userId),
    hasGlobalOrgOverride(userId),
  ]);
  return memberships.length > 0 || isAuthor || hasApiKey || isGlobalOrgAdmin;
}

/** Redirects to /login (no session) or / (logged in, but no organization_access, isAuthor grant, personal API key, or global admin override) — use at the top of the /dashboard layout. `memberships` already includes the global admin override entries (see getCombinedDashboardMemberships), so every caller reading it — picker, sidebar, org switcher, per-org access checks — sees every organization for such an admin without extra plumbing. */
export async function requireDashboardAccess(locale: AppLocale): Promise<DashboardAccess> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect({ href: "/login", locale });

  const [memberships, isAuthor, hasApiKey] = await Promise.all([
    getCombinedDashboardMemberships(userId as string),
    getIsAuthor(userId as string),
    getHasPersonalApiKey(userId as string),
  ]);
  if (memberships.length === 0 && !isAuthor && !hasApiKey) redirect({ href: "/", locale });

  return { userId: userId as string, memberships, isAuthor, hasApiKey };
}

/** /dashboard/author/* pages — the individual authoring space, gated strictly by users.is_author (not by any organization membership). */
export async function requireAuthorAccess(locale: AppLocale): Promise<{ userId: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect({ href: "/login", locale });

  if (!(await getIsAuthor(userId as string))) redirect({ href: "/dashboard", locale });
  return { userId: userId as string };
}

/** Server-action mirror of requireAuthorAccess — throws instead of redirecting. */
export async function requireAuthorActor(): Promise<{ userId: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  if (!(await getIsAuthor(userId))) throw new Error("Not authorized");
  return { userId };
}

/** /dashboard/api-keys/* pages — the individual API key space, gated strictly by owning at least one personal api_key row (not by any organization membership). Mirrors requireAuthorAccess. */
export async function requireApiKeyAccess(locale: AppLocale): Promise<{ userId: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect({ href: "/login", locale });

  if (!(await getHasPersonalApiKey(userId as string))) redirect({ href: "/dashboard", locale });
  return { userId: userId as string };
}

/** Server-action mirror of requireApiKeyAccess — throws instead of redirecting. */
export async function requireApiKeyActor(): Promise<{ userId: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  if (!(await getHasPersonalApiKey(userId))) throw new Error("Not authorized");
  return { userId };
}

/** Page gate for /dashboard/author/profile — broader than requireAuthorAccess (mirrors requireNewsWriterActor below): reachable by isAuthor, or by anyone who can write news for at least one organization, since they still need a byline there too. */
export async function requireNewsWriterAccess(locale: AppLocale): Promise<{ userId: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect({ href: "/login", locale });

  const [isAuthor, memberships] = await Promise.all([getIsAuthor(userId as string), getDashboardMemberships(userId as string)]);
  const canWriteForAnOrg = memberships.some((m) => hasOrgPermission(m, ORGANIZATION_PERMISSIONS.newsEdit));
  if (!isAuthor && !canWriteForAnOrg) redirect({ href: "/dashboard", locale });

  return { userId: userId as string };
}

/**
 * Gate for the byline author profile (name/slug/bio/logo) — broader
 * than requireAuthorActor, since a member who only ever writes under an
 * organization (never individually) still needs a byline. True if either
 * grant exists: isAuthor, or any organization_access with
 * organization.news.edit somewhere.
 */
export async function requireNewsWriterActor(): Promise<{ userId: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const [isAuthor, memberships] = await Promise.all([getIsAuthor(userId), getDashboardMemberships(userId)]);
  const canWriteForAnOrg = memberships.some((m) => hasOrgPermission(m, ORGANIZATION_PERMISSIONS.newsEdit));
  if (!isAuthor && !canWriteForAnOrg) throw new Error("Not authorized");

  return { userId };
}

/** Same as requireDashboardAccess, plus access to this specific organization — redirects to /dashboard (not /) so the viewer lands back inside their own space instead of getting bounced out entirely. */
export async function requireDashboardOrgAccess(locale: AppLocale, organizationId: number): Promise<{ access: DashboardAccess; membership: DashboardOrgMembership }> {
  const access = await requireDashboardAccess(locale);
  const membership = access.memberships.find((m) => m.organizationId === organizationId);
  if (!membership) redirect({ href: "/dashboard", locale });
  return { access, membership: membership as DashboardOrgMembership };
}

/** Same as requireDashboardOrgAccess, plus a specific org-scoped permission. */
export async function requireDashboardOrgPermission(locale: AppLocale, organizationId: number, permission: string): Promise<{ access: DashboardAccess; membership: DashboardOrgMembership }> {
  const result = await requireDashboardOrgAccess(locale, organizationId);
  if (!hasOrgPermission(result.membership, permission)) redirect({ href: `/dashboard/${organizationId}`, locale });
  return result;
}

/** Re-check for server actions — mirrors requireDashboardOrgAccess (including the global admin override) but throws instead of redirecting (no response to redirect). */
export async function requireDashboardOrgActor(organizationId: number): Promise<{ userId: string; membership: DashboardOrgMembership }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const memberships = await getCombinedDashboardMemberships(userId);
  const membership = memberships.find((m) => m.organizationId === organizationId);
  if (!membership) throw new Error("Not authorized");

  return { userId, membership };
}

/** Same as requireDashboardOrgActor, plus a specific org-scoped permission. */
export async function requireDashboardOrgActorPermission(organizationId: number, permission: string): Promise<{ userId: string; membership: DashboardOrgMembership }> {
  const result = await requireDashboardOrgActor(organizationId);
  if (!hasOrgPermission(result.membership, permission)) throw new Error("Not authorized");
  return result;
}

/** Owner-only actions (the role/permission matrix itself, and granting/revoking other users' access) — mirrors requireSuperAdminActor's "no role can grant itself more access" rationale, see packages/db/src/permissions.ts. */
export async function requireDashboardOrgOwnerActor(organizationId: number): Promise<{ userId: string; membership: DashboardOrgMembership }> {
  const result = await requireDashboardOrgActor(organizationId);
  if (!result.membership.isOwner) throw new Error("Not authorized");
  return result;
}

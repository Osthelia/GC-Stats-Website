/**
 * GC-Stats - rbac
 *
 * Global-scope role/permission checks for /admin access (redirect and
 * throwing variants for pages vs server actions). Org-level /dashboard
 * access is a separate system, see dashboard-rbac.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { cache } from "react";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { roles, rolePermissions, permissions, userRoles } from "@gc-stats/db";
import { getSession } from "@/lib/session";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export const ADMIN_ACCESS_PERMISSION = "admin.access";

export type CurrentUserAccess = {
  userId: string;
  isSuperAdmin: boolean;
  permissions: Set<string>;
};

/**
 * Global-scope roles/permissions only (scopeType='global', scopeId null) —
 * this table's 'team'/'publisher' scopeType values are unrelated to
 * /admin access. /dashboard (org-level features) does not use this table at
 * all; see apps/web/src/lib/dashboard-rbac.ts.
 * Deduplicated per request (layout, headers and dashboard checks all call it).
 */
export const getGlobalAccess = cache(async (userId: string): Promise<CurrentUserAccess> => {
  const rows = await db
    .select({
      isSuperAdmin: roles.isSuperAdmin,
      permissionName: permissions.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), eq(roles.scopeType, "global"), isNull(userRoles.scopeId)));

  const perms = new Set<string>();
  let isSuperAdmin = false;
  for (const row of rows) {
    if (row.isSuperAdmin) isSuperAdmin = true;
    if (row.permissionName) perms.add(row.permissionName);
  }
  return { userId, isSuperAdmin, permissions: perms };
});

export function hasAccess(access: CurrentUserAccess, permission: string): boolean {
  return access.isSuperAdmin || access.permissions.has(permission);
}

/**
 * Non-throwing check for the public site (tournament/match/player/team pages'
 * "Admin panel" shortcut, mirrors V1) — unlike requireAdminAccess this never
 * redirects, a logged-out or non-admin visitor just doesn't see the link.
 */
export async function isViewerAdmin(): Promise<boolean> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return false;
  const access = await getGlobalAccess(userId);
  return hasAccess(access, ADMIN_ACCESS_PERMISSION);
}

/** Redirects to /login (no session) or / (logged in, no admin access) — use at the top of /admin server layouts/pages. */
export async function requireAdminAccess(locale: AppLocale): Promise<CurrentUserAccess> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    // redirect() throws (Next's redirect-error mechanism) — execution never
    // continues past this point. The `as string` below just satisfies TS,
    // which types this navigation helper's redirect as returning `void` in
    // some resolution paths instead of `never`.
    redirect({ href: "/login", locale });
  }

  const access = await getGlobalAccess(userId as string);
  if (!hasAccess(access, ADMIN_ACCESS_PERMISSION)) {
    redirect({ href: "/", locale });
  }

  return access;
}

/**
 * Same as requireAdminAccess, plus a specific permission — redirects to
 * /admin (not /) when the user has admin.access but not this permission, so
 * they land back inside the panel rather than getting bounced to the public
 * site. Use at the top of any /admin/* page gated by more than the base
 * admin.access check.
 */
export async function requireAdminPermission(locale: AppLocale, permission: string): Promise<CurrentUserAccess> {
  const access = await requireAdminAccess(locale);
  if (!hasAccess(access, permission)) {
    redirect({ href: "/admin", locale });
  }
  return access;
}

/** Re-check for server actions — mirrors requireAdminAccess but throws instead of redirecting (no response to redirect). */
export async function requireActorAccess(): Promise<CurrentUserAccess> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  const access = await getGlobalAccess(userId);
  if (!hasAccess(access, ADMIN_ACCESS_PERMISSION)) throw new Error("Not authorized");
  return access;
}

/** Same as requireActorAccess, plus a specific permission. */
export async function requireActorPermission(permission: string): Promise<CurrentUserAccess> {
  const access = await requireActorAccess();
  if (!hasAccess(access, permission)) throw new Error("Not authorized");
  return access;
}

/** Role/permission management (/admin/roles) is super-admin-only, not permission-gated — see packages/db/src/permissions.ts. */
export async function requireSuperAdminActor(): Promise<CurrentUserAccess> {
  const access = await requireActorAccess();
  if (!access.isSuperAdmin) throw new Error("Not authorized");
  return access;
}

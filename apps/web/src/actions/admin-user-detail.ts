/**
 * GC-Stats - admin-user-detail
 *
 * Admin account-security support actions on a single user: force-disable
 * 2FA for lockout recovery, and force sign-out everywhere for a
 * compromised account. Kept behind a dedicated permission separate from
 * the read-only user list.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission, getGlobalAccess, hasAccess, ADMIN_ACCESS_PERMISSION } from "@/lib/rbac";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";

async function requireUsersManageActor(): Promise<{ isSuperAdmin: boolean }> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it. These are account-security support
  // actions (lockout recovery, revoking a compromised session/key), kept
  // behind a dedicated permission separate from usersView (read-only list).
  return requireActorPermission(PERMISSIONS.usersManage);
}

/** Only a super admin may weaken another admin's account: otherwise usersManage alone could strip a super admin's 2FA. */
async function canActOnTarget(actor: { isSuperAdmin: boolean }, targetUserId: string): Promise<boolean> {
  if (actor.isSuperAdmin) return true;
  return !hasAccess(await getGlobalAccess(targetUserId), ADMIN_ACCESS_PERMISSION);
}

export type ActionResult = { ok: true } | { ok: false; error: "notFound" | "protectedTarget" };

/**
 * Support action for a locked-out user (lost authenticator + recovery
 * codes): strips 2FA without the password confirmation the self-service
 * `disableTwoFactor` action requires (apps/web/src/actions/two-factor.ts) —
 * an admin acting here has already verified the user's identity out of band.
 */
export async function adminDisableTwoFactor(userId: string): Promise<ActionResult> {
  const actor = await requireUsersManageActor();

  const [existing] = await db.select({ id: users.id, twoFactorConfirmedAt: users.twoFactorConfirmedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing || !existing.twoFactorConfirmedAt) return { ok: false, error: "notFound" };
  if (!(await canActOnTarget(actor, userId))) return { ok: false, error: "protectedTarget" };

  await db
    .update(users)
    .set({ twoFactorSecret: null, twoFactorRecoveryCodes: null, twoFactorConfirmedAt: null, sessionsInvalidatedAt: new Date() })
    .where(eq(users.id, userId));
  await revokeOAuthTokens({ userId });
  return { ok: true };
}

/**
 * Signs the user out everywhere — support action for a compromised account.
 * The app runs `session: { strategy: "jwt" }` (auth.ts), so there's no DB
 * session row to delete: this bumps `sessionsInvalidatedAt`, which the
 * `jwt()` callback in auth.ts checks against every token's issue time and
 * rejects anything minted before it.
 */
export async function adminRevokeUserSessions(userId: string): Promise<ActionResult> {
  const actor = await requireUsersManageActor();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };
  if (!(await canActOnTarget(actor, userId))) return { ok: false, error: "protectedTarget" };

  // OAuth tokens die too: signing out a compromised account must cover third party apps.
  await db.update(users).set({ sessionsInvalidatedAt: new Date() }).where(eq(users.id, userId));
  await revokeOAuthTokens({ userId });
  return { ok: true };
}

/** Individual "can author news" grant, independent of any organization — the other way to get it is through an organization's own organization.news.edit/publish permission (organization_access + organization_role_permissions). See schema/auth.ts's users.isAuthor comment. */
export async function setUserAuthorAccess(userId: string, isAuthor: boolean): Promise<ActionResult> {
  await requireUsersManageActor();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.update(users).set({ isAuthor }).where(eq(users.id, userId));
  return { ok: true };
}

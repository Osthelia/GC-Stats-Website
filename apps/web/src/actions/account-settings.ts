/**
 * GC-Stats - account-settings
 *
 * Server actions backing the account security settings page: password
 * set/change, and related auth method bookkeeping. Password changes revoke
 * all other active sessions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { adminDb as db } from "@gc-stats/db/client";
import { users, accounts, authenticators } from "@gc-stats/db";
import { auth } from "@/auth";
import { countAuthMethods } from "@/lib/account-security";
import { createVerificationToken, consumeVerificationToken } from "@/lib/verification-tokens";
import { sendEmail } from "@/lib/email/client";
import { renderNotificationEmail } from "@/lib/email/notification-template";
import { APP_BASE_URL } from "@/lib/notify";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";
import { createSessionReissueToken } from "@/lib/session-reissue";

export type ActionResult = { ok: true } | { ok: false; error: string };
/** `reissueToken` goes straight into `useSession().update({ reissueToken })` so the calling tab survives the session invalidation. */
export type CredentialChangeResult = { ok: true; reissueToken: string } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60_000;

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

const RECENT_AUTH_MS = 10 * 60_000;

/**
 * Accounts with no password have nothing to re-check before a sensitive
 * change, so they need a fresh sign in instead: otherwise a stolen cookie
 * alone could add a password, move the email or delete the account.
 */
async function isRecentlyAuthenticated(): Promise<boolean> {
  const session = await auth();
  return typeof session?.authAt === "number" && Date.now() - session.authAt < RECENT_AUTH_MS;
}

/**
 * Sets or changes the account's password. Mirrors V1's
 * AccountSettingsController::setPassword: a current-password check is only
 * required when one is already set (nothing to check against otherwise —
 * covers OAuth/passkey-only accounts adding a password for the first time).
 */
export async function setPassword(input: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}): Promise<CredentialChangeResult> {
  const userId = await requireUserId();

  if (input.newPassword.length < 8) return { ok: false, error: "tooShort" };
  if (input.newPassword !== input.newPasswordConfirmation) return { ok: false, error: "mismatch" };

  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.passwordHash) {
    if (!input.currentPassword) return { ok: false, error: "currentRequired" };
    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "currentInvalid" };
  } else if (!(await isRecentlyAuthenticated())) {
    return { ok: false, error: "reauthRequired" };
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  // Kills every other session (a stolen cookie included) and every OAuth
  // token; this tab keeps its own session through the reissue token.
  await db.update(users).set({ passwordHash, sessionsInvalidatedAt: new Date() }).where(eq(users.id, userId));
  await revokeOAuthTokens({ userId });
  return { ok: true, reissueToken: await createSessionReissueToken(userId) };
}

export async function removePassword(): Promise<CredentialChangeResult> {
  const userId = await requireUserId();

  const authMethods = await countAuthMethods(userId);
  if (authMethods <= 1) return { ok: false, error: "lastAuthMethod" };

  // 2FA only exists to harden a password login (see actions/two-factor.ts) —
  // dropping the password removes its reason to exist, mirrors V1's
  // AccountSecurityService::removePassword wiping two_factor_* alongside it.
  await db
    .update(users)
    .set({ passwordHash: null, twoFactorSecret: null, twoFactorRecoveryCodes: null, twoFactorConfirmedAt: null, sessionsInvalidatedAt: new Date() })
    .where(eq(users.id, userId));
  await revokeOAuthTokens({ userId });
  return { ok: true, reissueToken: await createSessionReissueToken(userId) };
}

/**
 * Requests a change of the account's email. Same current-password gate as
 * setPassword/deleteAccount (only required when a password is actually set).
 * Nothing is written yet — a confirmation link is sent to the NEW address
 * and confirmEmailChange below does the actual update, so a typo'd address
 * the user doesn't control can never take over the account.
 */
export async function requestEmailChange(input: { newEmail: string; currentPassword: string }): Promise<ActionResult> {
  const userId = await requireUserId();
  const newEmail = input.newEmail.trim().toLowerCase();

  if (!newEmail) return { ok: false, error: "required" };
  if (!EMAIL_RE.test(newEmail)) return { ok: false, error: "invalid" };

  const [user] = await db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, error: "currentInvalid" };
  if (newEmail === user.email) return { ok: false, error: "sameEmail" };

  if (user.passwordHash) {
    if (!input.currentPassword) return { ok: false, error: "currentRequired" };
    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "currentInvalid" };
  } else if (!(await isRecentlyAuthenticated())) {
    return { ok: false, error: "reauthRequired" };
  }

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1);
  if (taken) return { ok: false, error: "taken" };

  const locale = await getLocale();
  const token = await createVerificationToken(`change-email:${userId}:${newEmail}`, EMAIL_CHANGE_TOKEN_TTL_MS);
  const t = await getTranslations({ locale, namespace: "accountSettings.email.confirmEmail" });
  const link = `${APP_BASE_URL}/${locale}/settings/confirm-email-change?userId=${userId}&email=${encodeURIComponent(newEmail)}&token=${token}`;
  const { html, text } = renderNotificationEmail(t("subject"), t("body"), link, t("cta"));
  await sendEmail({ to: newEmail, subject: t("subject"), html, text });

  return { ok: true };
}

/**
 * Consumes the confirmation link sent by requestEmailChange. Deliberately
 * unauthenticated (same pattern as actions/verify-email.ts and password
 * reset) — the random token IS the credential, the link may be opened in a
 * different browser than the one that requested the change.
 */
export async function confirmEmailChange(userId: string, newEmail: string, token: string): Promise<ActionResult> {
  const valid = await consumeVerificationToken(`change-email:${userId}:${newEmail}`, token);
  if (!valid) return { ok: false, error: "invalidOrExpired" };

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1);
  if (taken) return { ok: false, error: "taken" };

  // Same session-kill as a password change (auth.ts jwt callback) — every
  // outstanding token was minted for the old email, safest to force a fresh login.
  await db.update(users).set({ email: newEmail, emailVerified: new Date(), sessionsInvalidatedAt: new Date() }).where(eq(users.id, userId));
  await revokeOAuthTokens({ userId });
  return { ok: true };
}

export async function unlinkAccount(provider: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const authMethods = await countAuthMethods(userId);
  if (authMethods <= 1) return { ok: false, error: "lastAuthMethod" };

  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
  return { ok: true };
}

export async function deletePasskey(credentialID: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const authMethods = await countAuthMethods(userId);
  if (authMethods <= 1) return { ok: false, error: "lastAuthMethod" };

  await db
    .delete(authenticators)
    .where(and(eq(authenticators.userId, userId), eq(authenticators.credentialID, credentialID)));
  return { ok: true };
}

/**
 * Self-service account deletion. Mirrors V1's
 * AccountSettingsController::destroyAccount: a current-password check only
 * applies when a password is actually set (OAuth/passkey-only accounts skip
 * it). Hard delete — every FK into `users.id` is already `set null`/`cascade`
 * (verified across schema/*.ts), so no manual cleanup is needed: linked
 * `people`/reports/change-requests survive de-linked, sessions/accounts/
 * passkeys/api keys cascade away with the row.
 */
export async function deleteAccount(currentPassword: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.passwordHash) {
    if (!currentPassword) return { ok: false, error: "currentRequired" };
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "currentInvalid" };
  } else if (!(await isRecentlyAuthenticated())) {
    return { ok: false, error: "reauthRequired" };
  }

  await db.delete(users).where(eq(users.id, userId));
  return { ok: true };
}

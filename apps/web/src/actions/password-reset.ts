/**
 * GC-Stats - password-reset
 *
 * Server actions for the forgot-password flow: request and confirm. The
 * request always responds the same way regardless of whether the email
 * exists or has a password, to avoid account enumeration.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { adminDb as db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { getClientIp } from "@/lib/client-ip";
import { checkPasswordResetThrottle } from "@/lib/auth-throttle";
import { createVerificationToken, consumeVerificationToken } from "@/lib/verification-tokens";
import { sendEmail } from "@/lib/email/client";
import { renderNotificationEmail } from "@/lib/email/notification-template";
import { APP_BASE_URL } from "@/lib/notify";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";
import { logAccountActivity } from "@/lib/account-activity-log";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MS = 60 * 60_000;

export type RequestPasswordResetResult = { ok: true } | { ok: false; error: "invalid" | "tooManyAttempts" };

/**
 * Always resolves the same way whether or not the email has an account, or
 * has a password to reset (OAuth/passkey-only) — the response itself must
 * never be an oracle for actions/register.ts's already-flagged enumeration
 * risk. The email itself simply never arrives for those cases.
 */
export async function requestPasswordReset(rawEmail: string): Promise<RequestPasswordResetResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "invalid" };

  const ip = getClientIp(await headers());
  if (!(await checkPasswordResetThrottle(email, ip))) return { ok: false, error: "tooManyAttempts" };

  const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
  if (user?.passwordHash) {
    const locale = await getLocale();
    const token = await createVerificationToken(`reset-password:${email}`, RESET_TOKEN_TTL_MS);
    const t = await getTranslations({ locale, namespace: "auth.resetPassword.email" });
    const link = `${APP_BASE_URL}/${locale}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    const { html, text } = renderNotificationEmail(t("subject"), t("body"), link, t("cta"));
    await sendEmail({ to: email, subject: t("subject"), html, text });
    await logAccountActivity({ userId: user.id, actorUserId: null, event: "updated", description: "Password reset requested", ip, properties: { section: "passwordReset" } });
  }

  return { ok: true };
}

export type ResetPasswordResult = { ok: true } | { ok: false; error: "invalidOrExpired" | "tooShort" | "mismatch" };

export async function resetPassword(email: string, token: string, newPassword: string, newPasswordConfirmation: string): Promise<ResetPasswordResult> {
  if (newPassword.length < 8) return { ok: false, error: "tooShort" };
  if (newPassword !== newPasswordConfirmation) return { ok: false, error: "mismatch" };

  const valid = await consumeVerificationToken(`reset-password:${email}`, token);
  if (!valid) return { ok: false, error: "invalidOrExpired" };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  // Also invalidates every existing session — a password reset is exactly
  // the scenario (lost/compromised credentials) that must kill a stolen
  // cookie too, see auth.ts's jwt() callback.
  const [user] = await db.update(users).set({ passwordHash, sessionsInvalidatedAt: new Date() }).where(eq(users.email, email)).returning({ id: users.id });
  if (user) {
    await revokeOAuthTokens({ userId: user.id });
    await logAccountActivity({ userId: user.id, event: "updated", description: "Password reset with an emailed link", properties: { section: "password" } });
  }
  return { ok: true };
}

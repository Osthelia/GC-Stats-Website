/**
 * GC-Stats - two-factor
 *
 * Server actions for 2FA setup, confirmation and disable. Setup stores an
 * unconfirmed secret so an abandoned setup never locks anyone out; 2FA
 * requires the account to already have a password.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { auth } from "@/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import { revokeOAuthTokens } from "@/lib/oauth/revoke-tokens";
import { createSessionReissueToken } from "@/lib/session-reissue";
import { buildOtpauthUri, generateQrCodeDataUrl, generateRecoveryCodes, generateSecret, verifyTotpToken } from "@/lib/two-factor";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export type SetupTwoFactorResult =
  | { ok: true; secret: string; qrCodeDataUrl: string }
  | { ok: false; error: "passwordRequired" | "alreadyEnabled" };

/**
 * Starts (or restarts) 2FA setup: generates a fresh TOTP secret and stores
 * it right away, but unconfirmed (`twoFactorConfirmedAt` stays null) — it
 * only starts gating login once `confirmTwoFactor` verifies a real code
 * from the authenticator app, so an abandoned setup never locks anyone out.
 * Gated on the account already having a password: 2FA is a second factor on
 * top of the Credentials provider's password check (see auth.ts), it has no
 * meaning for OAuth/passkey-only accounts.
 */
export async function setupTwoFactor(): Promise<SetupTwoFactorResult> {
  const userId = await requireUserId();

  const [user] = await db
    .select({ email: users.email, passwordHash: users.passwordHash, twoFactorConfirmedAt: users.twoFactorConfirmedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.passwordHash) return { ok: false, error: "passwordRequired" };
  if (user.twoFactorConfirmedAt) return { ok: false, error: "alreadyEnabled" };

  const secret = generateSecret();
  await db.update(users).set({ twoFactorSecret: encrypt(secret) }).where(eq(users.id, userId));

  const otpauthUri = buildOtpauthUri(secret, user.email ?? userId);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUri);
  return { ok: true, secret, qrCodeDataUrl };
}

export type ConfirmTwoFactorResult = { ok: true; recoveryCodes: string[] } | { ok: false; error: "noPendingSetup" | "invalidCode" };

export async function confirmTwoFactor(code: string): Promise<ConfirmTwoFactorResult> {
  const userId = await requireUserId();

  const [user] = await db.select({ twoFactorSecret: users.twoFactorSecret }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.twoFactorSecret) return { ok: false, error: "noPendingSetup" };

  const secret = decrypt(user.twoFactorSecret);
  const valid = await verifyTotpToken(code, secret);
  if (!valid) return { ok: false, error: "invalidCode" };

  const recoveryCodes = generateRecoveryCodes();
  await db
    .update(users)
    .set({ twoFactorRecoveryCodes: encrypt(JSON.stringify(recoveryCodes)), twoFactorConfirmedAt: new Date() })
    .where(eq(users.id, userId));

  return { ok: true, recoveryCodes };
}

export type DisableTwoFactorResult = { ok: true; reissueToken: string } | { ok: false; error: "invalidPassword" };

export async function disableTwoFactor(password: string): Promise<DisableTwoFactorResult> {
  const userId = await requireUserId();

  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, error: "invalidPassword" };
  }

  await db
    .update(users)
    .set({ twoFactorSecret: null, twoFactorRecoveryCodes: null, twoFactorConfirmedAt: null, sessionsInvalidatedAt: new Date() })
    .where(eq(users.id, userId));
  await revokeOAuthTokens({ userId });
  return { ok: true, reissueToken: await createSessionReissueToken(userId) };
}

export type RegenerateRecoveryCodesResult = { ok: true; recoveryCodes: string[] } | { ok: false; error: "invalidPassword" | "notEnabled" };

export async function regenerateRecoveryCodes(password: string): Promise<RegenerateRecoveryCodesResult> {
  const userId = await requireUserId();

  const [user] = await db
    .select({ passwordHash: users.passwordHash, twoFactorConfirmedAt: users.twoFactorConfirmedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.twoFactorConfirmedAt) return { ok: false, error: "notEnabled" };
  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, error: "invalidPassword" };
  }

  const recoveryCodes = generateRecoveryCodes();
  await db.update(users).set({ twoFactorRecoveryCodes: encrypt(JSON.stringify(recoveryCodes)) }).where(eq(users.id, userId));
  return { ok: true, recoveryCodes };
}

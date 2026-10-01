/**
 * GC-Stats - two-factor
 *
 * TOTP two-factor auth helpers: secret/QR code generation, token
 * verification, and recovery code generation (same "xxxxx-xxxxx" shape as
 * V1's Fortify-generated codes).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import { generateSecret as generateTotpSecret, generate, verify, generateURI } from "otplib";
import QRCode from "qrcode";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { verificationTokens } from "@gc-stats/db";

const ISSUER = "GC-Stats";

export function generateSecret(): string {
  return generateTotpSecret();
}

export function buildOtpauthUri(secret: string, email: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  const cleaned = token.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const result = await verify({ secret, token: cleaned });
  return result.valid;
}

// A code is valid for one 30s step (no epoch tolerance), 90s covers clock skew.
const USED_CODE_TTL_MS = 90_000;

/** Marks a verified TOTP code as spent for this user. False means it was already used (replay). */
export async function claimTotpCode(userId: string, code: string): Promise<boolean> {
  const identifier = `totp-used:${userId}`;
  await db.delete(verificationTokens).where(and(eq(verificationTokens.identifier, identifier), lt(verificationTokens.expires, new Date())));
  const inserted = await db
    .insert(verificationTokens)
    .values({ identifier, token: crypto.createHash("sha256").update(code.replace(/\s+/g, "")).digest("hex"), expires: new Date(Date.now() + USED_CODE_TTL_MS) })
    .onConflictDoNothing()
    .returning({ token: verificationTokens.token });
  return inserted.length > 0;
}

const RECOVERY_CODE_COUNT = 8;

// "xxxxx-xxxxx" lowercase alphanumeric, same shape as V1's Fortify-generated
// codes — easy to read back when typing one in by hand.
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(6).toString("hex").slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

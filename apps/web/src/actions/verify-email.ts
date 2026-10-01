/**
 * GC-Stats - verify-email
 *
 * Server action confirming an email verification token and marking the
 * account's email as verified.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { users } from "@gc-stats/db";
import { consumeVerificationToken } from "@/lib/verification-tokens";

export type VerifyEmailResult = { ok: true } | { ok: false; error: "invalidOrExpired" };

export async function verifyEmailToken(email: string, token: string): Promise<VerifyEmailResult> {
  const valid = await consumeVerificationToken(`verify-email:${email}`, token);
  if (!valid) return { ok: false, error: "invalidOrExpired" };

  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.email, email));
  return { ok: true };
}

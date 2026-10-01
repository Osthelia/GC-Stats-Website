/**
 * GC-Stats - verification-tokens
 *
 * Creates and consumes single-use, expiring tokens shared by email
 * verification and password reset, both riding on Auth.js's adapter
 * `verification_tokens` table.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { verificationTokens } from "@gc-stats/db";

const DEFAULT_TTL_MS = 24 * 60 * 60_000;

// Only the hash is stored: a leaked table must not hand out working links.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Shared by email verification and password reset — both ride on Auth.js's
 * adapter `verification_tokens` table (identifier, token). `identifier` is
 * namespaced per use (see actions/register.ts, actions/password-reset.ts) so
 * the two flows' tokens never collide for the same email.
 */
export async function createVerificationToken(identifier: string, ttlMs = DEFAULT_TTL_MS): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(verificationTokens).values({ identifier, token: hashToken(token), expires: new Date(Date.now() + ttlMs) });
  return token;
}

/** Single-use: the row is deleted on lookup regardless of outcome, so a token can never be replayed. */
export async function consumeVerificationToken(identifier: string, token: string): Promise<boolean> {
  const [row] = await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, hashToken(token))))
    .returning({ expires: verificationTokens.expires });
  if (!row) return false;
  return row.expires.getTime() > Date.now();
}

/**
 * GC-Stats - token-crypto
 *
 * Generates and hashes opaque OAuth secrets (client secret, authorization
 * code, access/refresh tokens) and verifies PKCE S256 challenges. Plaintext
 * is never stored, only returned once to the caller at issuance.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";

// Same sha256-hash-only approach as lib/api-key-crypto.ts, generalized to
// every opaque OAuth secret (client secret, authorization code, access and
// refresh tokens) — plaintext is never stored, only returned once to the
// caller at issuance.
export function generateOpaqueToken(prefix: string): string {
  return `${prefix}${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashOpaqueToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

/** RFC 7636 §4.2: base64url, 43 to 128 characters (an S256 challenge is always 43). */
export function isValidCodeChallenge(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

/** PKCE S256 check (RFC 7636) — the only method this provider accepts. */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = Buffer.from(crypto.createHash("sha256").update(codeVerifier).digest("base64url"));
  const expected = Buffer.from(codeChallenge);
  return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
}

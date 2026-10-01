/**
 * GC-Stats - api-key-crypto
 *
 * Generates and hashes API keys, shared by /admin (personal keys) and
 * /dashboard (organization-scoped keys), so both use the same format and
 * hash.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";

/** Shared by /admin (personal keys) and /dashboard (org-scoped keys) — same key format, same hash. */
export function generatePlainApiKey(): string {
  return `gcs_${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(plainKey: string): string {
  return crypto.createHash("sha256").update(plainKey).digest("hex");
}

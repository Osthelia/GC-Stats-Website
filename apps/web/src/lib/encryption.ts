/**
 * GC-Stats — Two-factor secret encryption
 *
 * AES-256-GCM helpers for encrypting/decrypting `users.twoFactorSecret` and
 * `twoFactorRecoveryCodes` at rest.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import crypto from "node:crypto";

// AES-256-GCM at rest for `users.twoFactorSecret`/`twoFactorRecoveryCodes` —
// mirrors Laravel's `encrypted` Eloquent cast V1 uses on the same two
// columns. The key is derived from AUTH_SECRET rather than a separate env
// var: it's already a strong, per-deployment random value dedicated to this
// app, and one fewer secret to provision/rotate. The salt below is a fixed
// derivation label, not itself secret.
const KEY_DERIVATION_SALT = "gc-stats:two-factor:v1";

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set to encrypt/decrypt 2FA data");
  return crypto.scryptSync(secret, KEY_DERIVATION_SALT, 32);
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

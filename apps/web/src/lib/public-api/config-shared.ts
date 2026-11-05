/**
 * GC-Stats - public-api config-shared
 *
 * Public API settings shape, defaults and bounds, shared by the server, the
 * admin settings form and the /settings/api page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const PUBLIC_API_CONFIG_KEY = "public_api";

export type PublicApiConfig = {
  /** When false, no public key can be created and existing ones answer 403. */
  enabled: boolean;
  /** Requests per second of an account, shared by all its public keys. */
  ratePerSecond: number;
  /** Active public keys a single account can hold. */
  maxKeysPerUser: number;
};

export const PUBLIC_API_CONFIG_DEFAULTS: PublicApiConfig = {
  enabled: true,
  ratePerSecond: 15,
  maxKeysPerUser: 3,
};

export const PUBLIC_API_LIMIT_BOUNDS = {
  ratePerSecond: { min: 1, max: 1000 },
  maxKeysPerUser: { min: 1, max: 20 },
} as const;

export const PUBLIC_API_WINDOW_MS = 1_000;

export const PUBLIC_API_KEY_FIELD_LIMITS = {
  clientName: { min: 2, max: 80 },
  usageDescription: { min: 20, max: 1000 },
} as const;

export type PublicApiKeyField = keyof typeof PUBLIC_API_KEY_FIELD_LIMITS;
export type PublicApiKeyFieldError = "required" | "tooShort" | "tooLong";
export type PublicApiKeyFieldErrors = Partial<Record<PublicApiKeyField, PublicApiKeyFieldError>>;

function validateText(value: unknown, bounds: { min: number; max: number }): PublicApiKeyFieldError | null {
  if (typeof value !== "string" || value.trim() === "") return "required";
  const length = value.trim().length;
  if (length < bounds.min) return "tooShort";
  if (length > bounds.max) return "tooLong";
  return null;
}

/** Name and usage of a public key, as created by its owner or edited by an admin. */
export function validatePublicApiKeyFields(input: Record<PublicApiKeyField, unknown>): { ok: true; value: Record<PublicApiKeyField, string> } | { ok: false; fieldErrors: PublicApiKeyFieldErrors } {
  const fieldErrors: PublicApiKeyFieldErrors = {};
  for (const field of Object.keys(PUBLIC_API_KEY_FIELD_LIMITS) as PublicApiKeyField[]) {
    const error = validateText(input[field], PUBLIC_API_KEY_FIELD_LIMITS[field]);
    if (error) fieldErrors[field] = error;
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: { clientName: (input.clientName as string).trim(), usageDescription: (input.usageDescription as string).trim() } };
}

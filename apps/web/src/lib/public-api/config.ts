/**
 * GC-Stats - public-api config
 *
 * Public API settings stored in `site_config` (edited from /admin/settings),
 * read through a short per process cache like the OpenData settings.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { siteConfig } from "@gc-stats/db";
import { PUBLIC_API_CONFIG_DEFAULTS, PUBLIC_API_CONFIG_KEY, PUBLIC_API_LIMIT_BOUNDS, type PublicApiConfig } from "./config-shared";

const CONFIG_CACHE_MS = 15_000;

declare global {
  // eslint-disable-next-line no-var
  var __gcsPublicApiConfig: { value: PublicApiConfig; expiresAt: number } | undefined;
}

function clampLimit(value: unknown, bounds: { min: number; max: number }, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= bounds.min && value <= bounds.max ? value : fallback;
}

/** Stored JSON merged over the defaults, any invalid field falls back to its default. */
export function parsePublicApiConfig(raw: unknown): PublicApiConfig {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : PUBLIC_API_CONFIG_DEFAULTS.enabled,
    ratePerSecond: clampLimit(value.ratePerSecond, PUBLIC_API_LIMIT_BOUNDS.ratePerSecond, PUBLIC_API_CONFIG_DEFAULTS.ratePerSecond),
    maxKeysPerUser: clampLimit(value.maxKeysPerUser, PUBLIC_API_LIMIT_BOUNDS.maxKeysPerUser, PUBLIC_API_CONFIG_DEFAULTS.maxKeysPerUser),
  };
}

export async function readPublicApiConfig(): Promise<PublicApiConfig> {
  const [row] = await db.select({ value: siteConfig.value }).from(siteConfig).where(eq(siteConfig.key, PUBLIC_API_CONFIG_KEY)).limit(1);
  return parsePublicApiConfig(row?.value);
}

export async function getPublicApiConfig(): Promise<PublicApiConfig> {
  const cached = globalThis.__gcsPublicApiConfig;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await readPublicApiConfig();
  globalThis.__gcsPublicApiConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_MS };
  return value;
}

export function setCachedPublicApiConfig(value: PublicApiConfig): void {
  globalThis.__gcsPublicApiConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_MS };
}

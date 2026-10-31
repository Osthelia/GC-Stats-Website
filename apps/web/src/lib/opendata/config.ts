/**
 * GC-Stats - opendata config
 *
 * OpenData portal settings stored in `site_config` (edited from
 * /admin/settings). Read through a short per process cache: every replica
 * picks up a change within CONFIG_CACHE_MS.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { siteConfig } from "@gc-stats/db";
import { OPENDATA_CONFIG_DEFAULTS, OPENDATA_CONFIG_KEY, OPENDATA_LIMIT_BOUNDS, type OpenDataConfig } from "./config-shared";

const CONFIG_CACHE_MS = 15_000;

declare global {
  // eslint-disable-next-line no-var
  var __gcsOpenDataConfig: { value: OpenDataConfig; expiresAt: number } | undefined;
}

function clampLimit(value: unknown, bounds: { min: number; max: number }, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= bounds.min && value <= bounds.max ? value : fallback;
}

/** Stored JSON merged over the defaults, any invalid field falls back to its default. */
export function parseOpenDataConfig(raw: unknown): OpenDataConfig {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : OPENDATA_CONFIG_DEFAULTS.enabled,
    requireAccount: typeof value.requireAccount === "boolean" ? value.requireAccount : OPENDATA_CONFIG_DEFAULTS.requireAccount,
    browsePerMinute: clampLimit(value.browsePerMinute, OPENDATA_LIMIT_BOUNDS.browsePerMinute, OPENDATA_CONFIG_DEFAULTS.browsePerMinute),
    exportsPerHour: clampLimit(value.exportsPerHour, OPENDATA_LIMIT_BOUNDS.exportsPerHour, OPENDATA_CONFIG_DEFAULTS.exportsPerHour),
  };
}

export async function readOpenDataConfig(): Promise<OpenDataConfig> {
  const [row] = await db.select({ value: siteConfig.value }).from(siteConfig).where(eq(siteConfig.key, OPENDATA_CONFIG_KEY)).limit(1);
  return parseOpenDataConfig(row?.value);
}

export async function getOpenDataConfig(): Promise<OpenDataConfig> {
  const cached = globalThis.__gcsOpenDataConfig;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await readOpenDataConfig();
  globalThis.__gcsOpenDataConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_MS };
  return value;
}

export function setCachedOpenDataConfig(value: OpenDataConfig): void {
  globalThis.__gcsOpenDataConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_MS };
}

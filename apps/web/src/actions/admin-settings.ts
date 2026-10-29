/**
 * GC-Stats - admin-settings
 *
 * Admin server actions of /admin/settings: site wide configuration, the
 * OpenData portal settings for now.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { adminDb as db } from "@gc-stats/db/client";
import { siteConfig, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { diffChanges, logActivity } from "@/lib/activity-log";
import { readOpenDataConfig, setCachedOpenDataConfig } from "@/lib/opendata/config";
import { OPENDATA_CONFIG_KEY, OPENDATA_LIMIT_BOUNDS, type OpenDataConfig } from "@/lib/opendata/config-shared";

export type OpenDataSettingsField = keyof OpenDataConfig;
export type OpenDataSettingsFieldErrors = Partial<Record<OpenDataSettingsField, "required" | "invalid" | "outOfRange">>;
export type OpenDataSettingsResult = { ok: true; config: OpenDataConfig } | { ok: false; fieldErrors: OpenDataSettingsFieldErrors };

export type OpenDataSettingsInput = {
  enabled: unknown;
  requireAccount: unknown;
  browsePerMinute: unknown;
  exportsPerHour: unknown;
};

function validateLimit(value: unknown, bounds: { min: number; max: number }): "required" | "invalid" | "outOfRange" | null {
  if (value === null || value === undefined || value === "") return "required";
  if (typeof value !== "number" || !Number.isInteger(value)) return "invalid";
  if (value < bounds.min || value > bounds.max) return "outOfRange";
  return null;
}

export async function updateOpenDataSettings(input: OpenDataSettingsInput): Promise<OpenDataSettingsResult> {
  const access = await requireActorPermission(PERMISSIONS.settingsManage);

  const fieldErrors: OpenDataSettingsFieldErrors = {};
  if (typeof input.enabled !== "boolean") fieldErrors.enabled = "invalid";
  if (typeof input.requireAccount !== "boolean") fieldErrors.requireAccount = "invalid";
  const browseError = validateLimit(input.browsePerMinute, OPENDATA_LIMIT_BOUNDS.browsePerMinute);
  if (browseError) fieldErrors.browsePerMinute = browseError;
  const exportError = validateLimit(input.exportsPerHour, OPENDATA_LIMIT_BOUNDS.exportsPerHour);
  if (exportError) fieldErrors.exportsPerHour = exportError;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const config: OpenDataConfig = {
    enabled: input.enabled as boolean,
    requireAccount: input.requireAccount as boolean,
    browsePerMinute: input.browsePerMinute as number,
    exportsPerHour: input.exportsPerHour as number,
  };
  const before = await readOpenDataConfig();

  await db
    .insert(siteConfig)
    .values({ key: OPENDATA_CONFIG_KEY, value: config, updatedBy: access.userId })
    .onConflictDoUpdate({ target: siteConfig.key, set: { value: config, updatedAt: new Date(), updatedBy: access.userId } });
  setCachedOpenDataConfig(config);

  await logActivity({
    subject: "siteConfig",
    subjectId: OPENDATA_CONFIG_KEY,
    event: "updated",
    description: "Updated the OpenData settings",
    actorUserId: access.userId,
    changes: diffChanges(before, config),
  });

  return { ok: true, config };
}

/**
 * GC-Stats - stage-status
 *
 * Statuses shared by stages and stage containers (stage_status enum).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const STAGE_STATUSES = ["pending", "active", "completed"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export function isStageStatus(value: unknown): value is StageStatus {
  return typeof value === "string" && (STAGE_STATUSES as readonly string[]).includes(value);
}

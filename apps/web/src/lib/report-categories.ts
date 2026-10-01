/**
 * GC-Stats - report-categories
 *
 * Report reason categories, mirroring V1's UserReport::CATEGORIES. Shared
 * by the public report dialog (client component) and actions/forum.ts
 * (server-side validation).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const REPORT_CATEGORIES = [
  "toxicity",
  "discrimination",
  "misgendering",
  "harassment",
  "spam",
  "impersonation",
  "inappropriate_content",
  "sexual_content",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

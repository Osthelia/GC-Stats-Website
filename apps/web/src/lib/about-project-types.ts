/**
 * GC-Stats - about-project-types
 *
 * Pure constant, no DB import, safe to pull into client components (see
 * lib/admin-about.ts, which re-exports this but also imports the DB client
 * and must stay server only).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const ABOUT_PROJECT_TYPES = ["Website", "API", "DiscordBot"] as const;
export type AboutProjectType = (typeof ABOUT_PROJECT_TYPES)[number];

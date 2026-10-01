/**
 * GC-Stats - person-social-keys
 *
 * Shared by admin (actions/admin-players.ts) and /dashboard
 * (actions/dashboard-organizations.ts). No "website" key here: unlike
 * teams, players never have a website field.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const PERSON_SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord"] as const;
export type PersonSocialKey = (typeof PERSON_SOCIAL_KEYS)[number];

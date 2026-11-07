/**
 * GC-Stats - team-requests constants
 *
 * Vocabulary shared by the team requests server code and its UI.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const TEAM_REQUEST_TABS = ["recommended", "pending", "done"] as const;
export type TeamRequestTab = (typeof TEAM_REQUEST_TABS)[number];

export const TEAM_REQUEST_SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord", "website"] as const;
export type TeamRequestSocialKey = (typeof TEAM_REQUEST_SOCIAL_KEYS)[number];

/** Everything that can be flagged red in a request. */
export const TEAM_REQUEST_ITEMS = ["logo", ...TEAM_REQUEST_SOCIAL_KEYS, "roster"] as const;
export type TeamRequestItem = (typeof TEAM_REQUEST_ITEMS)[number];

export const TEAM_REQUEST_CONTACT_KINDS = ["organization", "manager", "coach", "other"] as const;
export type TeamRequestContactKind = (typeof TEAM_REQUEST_CONTACT_KINDS)[number];

export const TEAM_REQUEST_CONTACT_CHANNELS = ["twitter", "website", "discord", "email", "other"] as const;
export type TeamRequestContactChannel = (typeof TEAM_REQUEST_CONTACT_CHANNELS)[number];

export const TEAM_REQUEST_SCOPES = ["mine", "all"] as const;
export type TeamRequestScope = (typeof TEAM_REQUEST_SCOPES)[number];

/** A team that played within this window and was never asked is recommended. */
export const RECOMMENDED_WINDOW_DAYS = 60;

/** Matches scanned to find players who played without being on the roster. */
export const ROSTER_CHECK_MATCH_COUNT = 10;

export const TEAM_REQUEST_PAGE_SIZE = 20;
export const TEAM_REQUEST_MESSAGE_MAX = 4000;
export const TEAM_REQUEST_CONTACT_MAX = 300;

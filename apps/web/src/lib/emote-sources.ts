/**
 * GC-Stats - emote-sources
 *
 * Pure constant, no DB import, safe to pull into client components, same
 * split as lib/about-project-types.ts.
 *
 * `source` is free text, not a closed enum: it's the storage sub-folder name
 * ("twemoji" for the bulk Twemoji import, "teams" for team-logo-derived
 * emotes, or anything else an admin types when adding one by hand). A fixed
 * dropdown here would both misrepresent the real data and break next-intl on
 * any value it doesn't have a translation for.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const EMOTE_SOURCE_RE = /^[a-zA-Z0-9_-]{1,40}$/;

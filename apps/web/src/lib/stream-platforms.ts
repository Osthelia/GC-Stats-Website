/**
 * GC-Stats - stream-platforms
 *
 * stream_channels.platform is free text at the DB level, but the dashboard
 * only ever offers these three (see organization-streams-panel.tsx's icon
 * map).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const STREAM_PLATFORMS = ["twitch", "youtube", "tiktok"] as const;
export type StreamPlatform = (typeof STREAM_PLATFORMS)[number];

export const STREAM_CHANNEL_TYPES = ["official", "watchparty"] as const;
export type StreamChannelType = (typeof STREAM_CHANNEL_TYPES)[number];

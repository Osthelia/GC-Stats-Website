/**
 * GC-Stats - opendata config-shared
 *
 * OpenData settings shape, defaults and bounds, shared by the server and the
 * admin settings form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export const OPENDATA_CONFIG_KEY = "opendata";

export type OpenDataConfig = {
  /** Kill switch: when false every OpenData call answers 503. */
  enabled: boolean;
  /** Only signed in users can call the API (the explorer included). */
  requireAccount: boolean;
  /** Table pages per client (account, or IP when anonymous) per minute. */
  browsePerMinute: number;
  /** Full JSON exports per client per hour. */
  exportsPerHour: number;
};

export const OPENDATA_CONFIG_DEFAULTS: OpenDataConfig = {
  enabled: true,
  requireAccount: false,
  browsePerMinute: 30,
  exportsPerHour: 5,
};

export const OPENDATA_LIMIT_BOUNDS = {
  browsePerMinute: { min: 1, max: 600 },
  exportsPerHour: { min: 1, max: 100 },
} as const;

export const OPENDATA_BROWSE_WINDOW_MS = 60_000;
export const OPENDATA_EXPORT_WINDOW_MS = 3_600_000;

/**
 * GC-Stats - timezones
 *
 * Timezones offered in the site and admin timezone pickers.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const TIMEZONE_IDS = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Lisbon",
  "Europe/Rome",
  "Europe/Warsaw",
  "Europe/Kyiv",
  "Europe/Istanbul",
  "Europe/Moscow",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Sao_Paulo",
  "Africa/Casablanca",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Manila",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** UTC offset of `timeZone` at `at` as "+02:00" / "−05:00", DST included. */
export function timezoneOffset(timeZone: string, at: Date = new Date()): string {
  const raw = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /([+\-−])(\d{2}):(\d{2})/.exec(raw);
  if (!m) return "+00:00";
  return `${m[1] === "+" ? "+" : "−"}${m[2]}:${m[3]}`;
}

/** Picker entries with their current offset. */
export function getTimezones(at: Date = new Date()): { id: string; offset: string }[] {
  return TIMEZONE_IDS.map((id) => ({ id, offset: timezoneOffset(id, at) }));
}

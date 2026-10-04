/**
 * GC-Stats - datetime-local
 *
 * Conversions between a UTC instant (ISO string, what the server stores and
 * receives) and a `type="datetime-local"` input value expressed in a given
 * IANA timezone (the viewer's or the admin's, never the server's).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
// Explicit offset required, so a bare datetime-local value is never silently read in the server's timezone.
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wall clock parts of `date` in `timeZone`. */
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** ISO instant -> datetime-local value in `timeZone` ("" when absent or invalid). */
export function isoToZonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = zonedParts(d, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** datetime-local value read in `timeZone` -> ISO instant (null when empty or malformed). */
export function zonedInputToIso(value: string, timeZone: string): string | null {
  const m = LOCAL_RE.exec(value);
  if (!m) return null;
  const wallAsUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Two passes settle the offset around DST transitions.
  let instant = wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timeZone);
  instant = wallAsUtc - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant).toISOString();
}

/** Zone label at `date`, e.g. "Europe/Paris (UTC+2)". */
export function timezoneLabel(timeZone: string, locale: string, date: Date = new Date()): string {
  const offset = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "shortOffset" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value;
  const name = timeZone.replace(/_/g, " ");
  return offset ? `${name} (${offset})` : name;
}

/** Server side: parses an ISO instant with an explicit offset, null otherwise. */
export function parseIsoInstant(value: string): Date | null {
  if (!ISO_INSTANT_RE.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

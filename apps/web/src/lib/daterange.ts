/**
 * GC-Stats - daterange
 *
 * Postgres daterange values round-trip through drizzle as their literal
 * string form (e.g. "[2024-01-01,2024-06-01)" or "[2024-01-01,)" for an
 * open-ended/still-current period), see packages/db/src/schema/custom-types.ts.
 * These helpers parse and build that string form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export function rangeLower(range: string): string | null {
  const match = range.match(/^[[(]([^,]*),/);
  return match && match[1] ? match[1] : null;
}

export function rangeUpper(range: string): string | null {
  const match = range.match(/,([^\])]*)[\])]$/);
  return match && match[1] ? match[1] : null;
}

export function rangeIsOpen(range: string): boolean {
  return rangeUpper(range) === null;
}

/** `[from,)` — a period starting today with no end, i.e. "current". */
export function openRangeFrom(date: string): string {
  return `[${date},)`;
}

/** Closes an open range at `until` (exclusive upper bound), keeping the original lower bound. */
export function closeRange(range: string, until: string): string {
  const lower = rangeLower(range);
  const effectiveUntil = lower && lower > until ? lower : until;
  return `[${lower ?? ""},${effectiveUntil})`;
}

// V1 migration sentinel for "date unknown" (never a real membership start).
const UNKNOWN_DATE_SENTINEL = "1900-01-01";

export function isUnknownDate(date: string | null): boolean {
  return date === UNKNOWN_DATE_SENTINEL;
}

/** "2024-01-01" -> "01/2024" — the compact month/year format roster listings show (mirrors V1's PivotDate::format(..., 'm/Y')). */
export function monthYear(date: string | null): string | null {
  if (!date) return null;
  const [y, m] = date.split("-");
  return y && m ? `${m}/${y}` : null;
}

/** Month/year display for roster listings, surfacing the "1900" sentinel as `unknownLabel` instead of a fake date and any true absence as "-". */
export function displayMonthYear(date: string | null, unknownLabel: string): string {
  if (isUnknownDate(date)) return unknownLabel;
  return monthYear(date) ?? "-";
}

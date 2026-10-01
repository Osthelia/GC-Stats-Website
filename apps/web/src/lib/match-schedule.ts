/**
 * GC-Stats - match-schedule
 *
 * Normalizes `matches.scheduled_at`'s "unknown date" sentinel (a migrated
 * MySQL zero-date, ~1899-12-31) to null, so every caller treats it exactly
 * like "no date set" rather than a real date in the far past.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
const UNKNOWN_DATE_CUTOFF = "1900-01-01T00:00:00.000Z";

/** Same check as normalizeScheduledAt, keeping the Date type. */
export function knownScheduledAt(value: Date | null): Date | null {
  if (!value) return null;
  return value.toISOString() < UNKNOWN_DATE_CUTOFF ? null : value;
}

export function normalizeScheduledAt(value: Date | null): string | null {
  if (!value) return null;
  const iso = value.toISOString();
  return iso < UNKNOWN_DATE_CUTOFF ? null : iso;
}

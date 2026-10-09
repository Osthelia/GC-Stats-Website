/**
 * GC-Stats - home-day-order
 *
 * Pure helper, deliberately kept in its own file with zero server-only
 * imports (no `db`, no `@gc-stats/storage`): the "use client"
 * matches-panel component needs these exact comparators, and importing a
 * value (not just a type) from lib/home-data.ts would drag that file's
 * top-level `db`/`sharp` imports into the client bundle.
 *
 * Day order for the home matches feed ("Tous"): Today, then every future day
 * ascending (Tomorrow, day+2, ...), then every past day descending (most
 * recent result first). This also gives "Upcoming" (offsets >= 0) and
 * "Finished" (offsets <= 0) their correct sub-order for free, since each is
 * a pure subset of one of the two halves.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import type { HomeMatch } from "@/lib/home-data";

export type HomeDay = { dayKey: string; label: string; date: string; dayOffset: number; matches: HomeMatch[] };

// "en-CA" formats as YYYY-MM-DD, the calendar day of `date` in `timeZone`.
function zonedDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Groups matches by calendar day in `timeZone`, so the day matches what the viewer sees on the clock. */
export function groupHomeDays(matches: HomeMatch[], opts: { timeZone: string; locale: string; todayText: string; tomorrowText: string }): HomeDay[] {
  const { timeZone, locale, todayText, tomorrowText } = opts;
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone });
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone });
  const todayMs = Date.parse(`${zonedDayKey(new Date(), timeZone)}T00:00:00Z`);

  const dayMap = new Map<string, HomeDay>();
  for (const match of matches) {
    const dayKey = zonedDayKey(match.scheduledAt, timeZone);
    let day = dayMap.get(dayKey);
    if (!day) {
      const dayOffset = Math.round((Date.parse(`${dayKey}T00:00:00Z`) - todayMs) / 86_400_000);
      const label = dayOffset === 0 ? todayText : dayOffset === 1 ? tomorrowText : weekdayFormat.format(match.scheduledAt);
      day = { dayKey, label, date: dateFormat.format(match.scheduledAt), dayOffset, matches: [] };
      dayMap.set(dayKey, day);
    }
    day.matches.push(match);
  }

  const days = [...dayMap.values()].sort(compareDayOrder);
  for (const day of days) day.matches = sortDayMatches(day.matches, day.dayOffset);
  return days;
}

export function compareDayOrder(a: { dayOffset: number }, b: { dayOffset: number }): number {
  const aFuture = a.dayOffset >= 0;
  const bFuture = b.dayOffset >= 0;
  if (aFuture !== bFuture) return aFuture ? -1 : 1;
  return aFuture ? a.dayOffset - b.dayOffset : b.dayOffset - a.dayOffset;
}

/**
 * Match order within a single day. Today: live matches first, then the rest
 * ordered by proximity to "now" (soonest upcoming / most-recently-finished
 * first). Every other day: plain chronological (already closest-to-farthest
 * within that day, since all its matches share the same future/past side).
 */
export function sortDayMatches<T extends { status: string; scheduledAt: Date }>(matches: T[], dayOffset: number): T[] {
  if (dayOffset !== 0) return [...matches].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const now = Date.now();
  return [...matches].sort((a, b) => {
    const aLive = a.status === "live";
    const bLive = b.status === "live";
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aLive) return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    return Math.abs(a.scheduledAt.getTime() - now) - Math.abs(b.scheduledAt.getTime() - now);
  });
}

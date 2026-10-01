/**
 * GC-Stats - route
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { calendarResponse, parseCalendarId } from "@/lib/calendar-ics";

/** iCalendar feed of one tournament's matches, `/api/calendar/tournament/42.ics`. */
export async function GET(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const tournamentId = parseCalendarId((await params).tournamentId);
  return calendarResponse(request, tournamentId === null ? null : { kind: "tournament", tournamentId });
}

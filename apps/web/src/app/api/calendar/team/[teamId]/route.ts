/**
 * GC-Stats - route
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { calendarResponse, parseCalendarId } from "@/lib/calendar-ics";

/** iCalendar feed of one team's matches, `/api/calendar/team/42.ics`. */
export async function GET(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const teamId = parseCalendarId((await params).teamId);
  return calendarResponse(request, teamId === null ? null : { kind: "team", teamId });
}

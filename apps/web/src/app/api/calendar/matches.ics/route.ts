/**
 * GC-Stats - route
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { calendarResponse } from "@/lib/calendar-ics";

/** iCalendar feed of all matches (recent results and upcoming). */
export async function GET(request: Request) {
  return calendarResponse(request, { kind: "all" });
}

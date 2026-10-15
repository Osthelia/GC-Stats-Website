/**
 * GC-Stats - route
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { calendarResponse } from "@/lib/calendar-ics";
import { gameFromParams } from "@/lib/game";

/** iCalendar feed of all matches (recent results and upcoming). */
export async function GET(request: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = await gameFromParams(params);
  return calendarResponse(game, request, { kind: "all" });
}

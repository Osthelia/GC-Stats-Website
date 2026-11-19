/**
 * GC-Stats - route
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { calendarResponse, parseCalendarId } from "@/lib/calendar-ics";
import { gameFromParams } from "@/lib/game";
import { publicGameGate } from "@/lib/api/game-gate";

/** iCalendar feed of one team's matches, `/api/calendar/team/42.ics`. */
export async function GET(request: Request, { params }: { params: Promise<{ teamId: string; game: string }> }) {
  const game = await gameFromParams(params);
  const hidden = publicGameGate(game);
  if (hidden) return hidden;
  const teamId = parseCalendarId((await params).teamId);
  return calendarResponse(game, request, teamId === null ? null : { kind: "team", teamId });
}

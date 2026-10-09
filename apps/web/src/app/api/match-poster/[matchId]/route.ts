/**
 * GC-Stats - route
 *
 * Data behind the match screenshot dialog (components/match/match-poster-dialog.tsx), loaded on open.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { parseEntityId } from "@/lib/entity-id";
import { aggregateMatchStats, getCompletedMatchStats, getMatchHeader, getMatchMaps, getMatchMapsStatsBatch } from "@/lib/match-page-data";

export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const matchId = parseEntityId((await params).matchId);
  if (matchId == null) return NextResponse.json({ error: "Invalid match id" }, { status: 400 });

  const match = await getMatchHeader(matchId);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const [maps, { roundsByMapId }] =
    match.status === "completed"
      ? await getCompletedMatchStats(matchId, match.a.entrantId, match.b.entrantId)
      : await Promise.all([getMatchMaps(matchId, match.a.entrantId, match.b.entrantId), getMatchMapsStatsBatch(matchId, match.a.entrantId, match.b.entrantId)]);
  const aggregated = aggregateMatchStats(maps, match.a.entrantId, match.b.entrantId);

  return NextResponse.json({ match, maps, aggregated, roundsByMapId });
}

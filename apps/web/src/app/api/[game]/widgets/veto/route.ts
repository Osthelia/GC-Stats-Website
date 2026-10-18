/**
 * GC-Stats - route
 *
 * Public live data endpoint for the Veto widget (served by the separate
 * Widgets front): the veto of a match, never cached since it changes live.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import { checkRateLimitDb } from "@/lib/rate-limit-db";
import { getClientIp } from "@/lib/client-ip";
import { getVetoState } from "@/lib/veto/service";
import { getVetoMatchHeader } from "@/lib/veto/team-view";
import { SITE_URL, intParamError, widgetPreflight } from "@/lib/widget-api";
import { mapSplashUrl } from "@/lib/valorant-maps";
import { gameFromParams } from "@/lib/game";
import { gameHasMaps } from "@gc-stats/db/game";

const HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store" };

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: HEADERS });
}

function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${SITE_URL}${url}` : url;
}

export function OPTIONS() {
  return widgetPreflight();
}

export async function GET(request: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = await gameFromParams(params);
  if (!gameHasMaps(game)) return error(404, "Widget not available for this game");
  const { matches, stageContainers, stages, tournaments } = gameTables(game);
  if (!(await checkRateLimitDb(`veto-widget:${getClientIp(request.headers)}`, 10_000, 150))) return error(429, "Too many requests");
  const { searchParams } = new URL(request.url);
  const invalid = intParamError(searchParams, "match_id");
  if (invalid) return error(400, invalid);
  const matchId = Number(searchParams.get("match_id"));
  if (!matchId) return error(400, 'Missing "match_id"');

  const [row] = await db
    .select({ vetoEnabled: tournaments.vetoEnabled })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!row?.vetoEnabled) return error(404, "Veto not available for this match");

  const [state, header] = await Promise.all([getVetoState(game, matchId), getVetoMatchHeader(game, matchId)]);
  if (!state || !header) return error(404, "Veto not available for this match");

  const team = (id: number, name: string, side: typeof header.a) => ({ id, name, short_name: side.shortName, logo_url: absoluteUrl(side.logoUrl), logo_url_light: absoluteUrl(side.logoUrlLight) });
  return NextResponse.json(
    {
      match_id: matchId,
      tournament_name: header.tournamentName,
      best_of: state.bestOf,
      status: state.status,
      team_a: team(state.entrantA.id, state.entrantA.name, header.a),
      team_b: team(state.entrantB.id, state.entrantB.name, header.b),
      ready_a: state.readyA,
      ready_b: state.readyB,
      first_team_id: state.firstEntrantId,
      step_index: state.stepIndex,
      step_started_at: state.stepStartedAt,
      timeout_seconds: state.timeoutSeconds,
      server_now: new Date().toISOString(),
      steps: state.steps.map((s) => ({ kind: s.kind, team_id: s.entrantId, map_index: s.mapIndex })),
      pool: state.pool.map((name) => ({ name, image_url: absoluteUrl(mapSplashUrl(name)) })),
      vetos: state.records.map((r, index) => ({ order: index + 1, team_id: r.entrantId, map_name: r.mapName, type: r.type, side: r.side, side_picked_by_team_id: r.sidePickedByEntrantId })),
    },
    { headers: HEADERS }
  );
}

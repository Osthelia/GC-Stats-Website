/**
 * GC-Stats - route
 *
 * Public data endpoint for the Heatmap widget (served by the separate
 * Widgets front). Same query params as the widget URL, plus `preview=1` for
 * fabricated data (never touches the position history).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getHeatmapPositions, getHeatmapPreviewPositions } from "@/lib/widget-data";
import { parseHeatmapWidgetParams } from "@/lib/widget-params";
import { VALORANT_MINIMAPS, isValorantMapKey } from "@/lib/valorant-minimaps";
import { SITE_URL, dateParamError, intParamError, parseDateBound, searchParamsToRecord, widgetError, widgetJson, widgetPreflight } from "@/lib/widget-api";

export function OPTIONS() {
  return widgetPreflight();
}

function mapPayload(key: string) {
  return { key, imageUrl: `${SITE_URL}${VALORANT_MINIMAPS[key]!.image}` };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("preview") === "1") {
    return widgetJson({ map: mapPayload("ascent"), positions: getHeatmapPreviewPositions() });
  }

  const mapRaw = searchParams.get("map")?.toLowerCase();
  if (!mapRaw) return widgetError(400, 'Missing "map"');
  if (!isValorantMapKey(mapRaw)) return widgetError(400, `Invalid "map": unknown map "${mapRaw}"`);

  const error =
    intParamError(searchParams, "tournament_id") ??
    intParamError(searchParams, "team_id") ??
    intParamError(searchParams, "player_id") ??
    intParamError(searchParams, "time_start") ??
    intParamError(searchParams, "time_end") ??
    dateParamError(searchParams, "start_date") ??
    dateParamError(searchParams, "end_date");
  if (error) return widgetError(400, error);

  const p = parseHeatmapWidgetParams(searchParamsToRecord(searchParams));

  const positions = await getHeatmapPositions({
    mapKey: mapRaw,
    tournamentId: p.tournamentId ?? undefined,
    start: parseDateBound(p.startDate, false),
    end: parseDateBound(p.endDate, true),
    side: p.side ?? undefined,
    teamId: p.teamId ?? undefined,
    playerId: p.playerId ?? undefined,
    eventTypes: p.eventTypes.length > 0 ? p.eventTypes : undefined,
    agent: p.agent ?? undefined,
    timeStart: p.timeStart ?? undefined,
    timeEnd: p.timeEnd ?? undefined,
    timeReference: p.timeReference,
  });

  return widgetJson({ map: mapPayload(mapRaw), positions });
}

/**
 * GC-Stats - route
 *
 * Public data endpoint for the Head to Head widget (served by the separate
 * Widgets front). Same query params as the widget URL.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { teams } from "@gc-stats/db";
import { visibleTeam } from "@/lib/ghost-visibility";
import { getHeadToHeadMapComparison, getMapPoolForPatch } from "@/lib/match-page-data";
import { parseHeadToHeadWidgetParams } from "@/lib/widget-params";
import { getCurrentLogoUrls } from "@/lib/admin-logos";
import { SITE_URL, dateParamError, intParamError, parseDateBound, searchParamsToRecord, widgetError, widgetJson, widgetPreflight } from "@/lib/widget-api";

export function OPTIONS() {
  return widgetPreflight();
}

function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${SITE_URL}${url}` : url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const error =
    intParamError(searchParams, "team_a") ??
    intParamError(searchParams, "team_b") ??
    intParamError(searchParams, "tournament_id") ??
    dateParamError(searchParams, "start_date") ??
    dateParamError(searchParams, "end_date");
  if (error) return widgetError(400, error);

  const p = parseHeadToHeadWidgetParams(searchParamsToRecord(searchParams));
  if (p.teamA == null || p.teamB == null) return widgetError(400, 'Missing "team_a" or "team_b"');
  if (p.teamA === p.teamB) return widgetError(400, '"team_a" and "team_b" must be different');

  const teamRows = await db
    .select({ id: teams.id, name: teams.name, shortName: teams.shortName, countryCode: teams.countryCode })
    .from(teams)
    .where(and(inArray(teams.id, [p.teamA, p.teamB]), visibleTeam));
  const teamA = teamRows.find((row) => row.id === p.teamA);
  const teamB = teamRows.find((row) => row.id === p.teamB);
  if (!teamA || !teamB) return widgetError(404, "Team not found");

  const mapPool = p.mapPool.length > 0 ? p.mapPool : p.patch ? await getMapPoolForPatch(p.patch) : undefined;

  const [rows, logos] = await Promise.all([
    getHeadToHeadMapComparison(p.teamA, p.teamB, {
      tournamentId: p.tournamentId ?? undefined,
      start: parseDateBound(p.startDate, false),
      end: parseDateBound(p.endDate, true),
      mapPool: mapPool && mapPool.length > 0 ? mapPool : undefined,
    }),
    getCurrentLogoUrls("team", [p.teamA, p.teamB]),
  ]);

  const side = (team: typeof teamA) => ({
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    countryCode: team.countryCode,
    logoUrl: absoluteUrl(logos.get(team.id) ?? null),
  });

  return widgetJson({ teamA: side(teamA), teamB: side(teamB), rows });
}

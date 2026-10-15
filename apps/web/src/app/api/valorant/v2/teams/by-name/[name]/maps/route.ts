/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: a team's per-map stats by name, filterable via query params.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseTeamMapsFilter } from "@/lib/api/v2/params";
import { getTeamMapsByNameV2 } from "@/lib/api/v2/queries/teams";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return withApiV1(request, "/v2/teams/by-name/:name/maps", async () => {
    const { name } = await params;
    const filter = parseTeamMapsFilter(new URL(request.url).searchParams);
    return getTeamMapsByNameV2(name, filter);
  });
}

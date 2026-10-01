/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: a team's match history by name, filterable via query params.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseTeamMatchesFilter } from "@/lib/api/v2/params";
import { getTeamMatchesByNameV2 } from "@/lib/api/v2/queries/teams";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return withApiV1(request, "/v2/teams/by-name/:name/matches", async () => {
    const { name } = await params;
    const filter = parseTeamMatchesFilter(new URL(request.url).searchParams);
    return getTeamMatchesByNameV2(name, filter);
  });
}

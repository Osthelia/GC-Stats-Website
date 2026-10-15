/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: a player's aggregate stats by id, filterable via query params.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId, parseStatsFilter } from "@/lib/api/v1/params";
import { getPlayerStatsV2 } from "@/lib/api/v2/queries/players";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(request, "/v2/players/:id/stats", async () => {
    const { id } = await params;
    const filter = parseStatsFilter(new URL(request.url).searchParams);
    return getPlayerStatsV2(parsePathId(id), filter);
  });
}

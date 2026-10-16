/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: a player's aggregate stats by name, filterable via query params.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseStatsFilter } from "@/lib/api/v1/params";
import { getPlayerStatsByNameV2 } from "@/lib/api/v2/queries/players";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ name: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, "/v2/players/by-name/:name/stats", async () => {
    const { name } = await params;
    const filter = parseStatsFilter(new URL(request.url).searchParams);
    return getPlayerStatsByNameV2(game, name, filter);
  });
}

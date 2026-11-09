/**
 * GC-Stats — route
 *
 * Public API v3 endpoint returning a team's match history, by name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseTeamMatchesFilter } from "@/lib/api/v2/params";
import { getTeamMatchesByNameV2 } from "@/lib/api/v2/queries/teams";
import { withPhasesPaginated } from "@/lib/api/v3/queries/phases";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ name: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, game, "/v3/teams/by-name/:name/matches", async () => {
    const { name } = await params;
    const filter = parseTeamMatchesFilter(new URL(request.url).searchParams);
    return withPhasesPaginated(game, await getTeamMatchesByNameV2(game, name, filter));
  });
}

/**
 * GC-Stats — route
 *
 * Public API v3 endpoint returning a player's match history, by id.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { parseTeamMatchesFilter } from "@/lib/api/v2/params";
import { getPlayerMatchesV2 } from "@/lib/api/v2/queries/players";
import { withPhasesPaginated } from "@/lib/api/v3/queries/phases";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, game, "/v3/players/:id/matches", async () => {
    const { id } = await params;
    const filter = parseTeamMatchesFilter(new URL(request.url).searchParams);
    return withPhasesPaginated(game, await getPlayerMatchesV2(game, parsePathId(id), filter));
  });
}

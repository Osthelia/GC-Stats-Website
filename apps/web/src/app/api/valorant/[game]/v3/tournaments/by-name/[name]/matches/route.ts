/**
 * GC-Stats — route
 *
 * Public API v3 endpoint returning a tournament's matches, by name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseTournamentMatchesFilter } from "@/lib/api/v2/params";
import { getTournamentMatchesByNameV2 } from "@/lib/api/v2/queries/tournaments";
import { withPhasesPaginated } from "@/lib/api/v3/queries/phases";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ name: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, "/v3/tournaments/by-name/:name/matches", async () => {
    const { name } = await params;
    const filter = parseTournamentMatchesFilter(new URL(request.url).searchParams);
    return withPhasesPaginated(game, await getTournamentMatchesByNameV2(game, name, filter));
  });
}

/**
 * GC-Stats — route
 *
 * Public API v1 endpoint: tournament search by name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { searchTournamentsByName } from "@/lib/api/v1/queries/tournaments";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ name: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, game, "/v1/tournaments/by-name/:name", async () => {
    const { name } = await params;
    return searchTournamentsByName(game, name);
  });
}

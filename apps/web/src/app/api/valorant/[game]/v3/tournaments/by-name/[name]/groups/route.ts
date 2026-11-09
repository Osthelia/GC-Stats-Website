/**
 * GC-Stats — route
 *
 * Public API v3 endpoint returning the swiss and round robin standings and match order of a tournament, by name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePositiveIntParam } from "@/lib/api/v1/params";
import { getTournamentGroupsByNameV3 } from "@/lib/api/v3/queries/groups";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ name: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, game, "/v3/tournaments/by-name/:name/groups", async () => {
    const { name } = await params;
    const phaseId = parsePositiveIntParam(new URL(request.url).searchParams, "phase_id");
    return getTournamentGroupsByNameV3(game, name, phaseId);
  });
}

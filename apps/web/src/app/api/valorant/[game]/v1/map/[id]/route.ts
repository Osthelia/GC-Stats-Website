/**
 * GC-Stats — route
 *
 * Public API v1 endpoint: full details of a single map by id.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { getMapFullResponse } from "@/lib/api/v1/queries/map";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, "/v1/map/:id", async () => {
    const { id } = await params;
    return getMapFullResponse(game, parsePathId(id));
  });
}

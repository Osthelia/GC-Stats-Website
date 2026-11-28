/**
 * GC-Stats — route
 *
 * Public API v3 endpoint listing matches, with the full phase object.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseMatchesFilter } from "@/lib/api/v2/params";
import { getMatchesV3 } from "@/lib/api/v3/queries/matches";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, "/v3/matches", async () => getMatchesV3(game, parseMatchesFilter(new URL(request.url).searchParams)));
}

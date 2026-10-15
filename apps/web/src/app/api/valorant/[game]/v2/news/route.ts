/**
 * GC-Stats - route
 *
 * Public API v2 endpoint: list news articles, filterable via query params.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseNewsFilter } from "@/lib/api/v2/params";
import { getNewsV2 } from "@/lib/api/v2/queries/news";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(request, "/v2/news", async () => {
    const filter = parseNewsFilter(new URL(request.url).searchParams);
    return getNewsV2(game, filter);
  });
}

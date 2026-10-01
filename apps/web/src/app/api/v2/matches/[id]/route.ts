/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: full stat breakdown for a single match.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { getMatchStatsResponse } from "@/lib/api/v1/queries/matches";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(request, "/v2/matches/:id", async () => {
    const { id } = await params;
    return getMatchStatsResponse(parsePathId(id));
  });
}

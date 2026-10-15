/**
 * GC-Stats — route
 *
 * Public API v3 endpoint returning full match details, by id.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { getMatchV3Response } from "@/lib/api/v3/queries/matches";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(request, "/v3/matches/:id", async () => {
    const { id } = await params;
    return getMatchV3Response(parsePathId(id));
  });
}

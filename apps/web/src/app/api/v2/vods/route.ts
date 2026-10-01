/**
 * GC-Stats - route
 *
 * Public API v2 endpoint listing VODs, filtered by query params.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseVodsFilter } from "@/lib/api/v2/params";
import { getVodsV2 } from "@/lib/api/v2/queries/vods";

export async function GET(request: Request) {
  return withApiV1(request, "/v2/vods", async () => {
    const filter = parseVodsFilter(new URL(request.url).searchParams);
    return getVodsV2(filter);
  });
}

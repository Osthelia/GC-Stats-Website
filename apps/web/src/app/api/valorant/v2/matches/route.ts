/**
 * GC-Stats - route
 *
 * Public API v2 endpoint: list matches, filterable via query params.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseMatchesFilter } from "@/lib/api/v2/params";
import { getMatchesV2 } from "@/lib/api/v2/queries/matches";

export async function GET(request: Request) {
  return withApiV1(request, "/v2/matches", async () => {
    const filter = parseMatchesFilter(new URL(request.url).searchParams);
    return getMatchesV2(filter);
  });
}

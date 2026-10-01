/**
 * GC-Stats - route
 *
 * Public API v2 endpoint: cross-entity search (players, teams, tournaments, etc).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseSearchFilter } from "@/lib/api/v2/params";
import { searchV2 } from "@/lib/api/v2/queries/search";

export async function GET(request: Request) {
  return withApiV1(request, "/v2/search", async () => {
    const filter = parseSearchFilter(new URL(request.url).searchParams);
    return searchV2(filter.q, filter.limit);
  });
}

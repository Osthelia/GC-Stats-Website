/**
 * GC-Stats - route
 *
 * Public API v2 endpoint listing tournaments, filtered by query params.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseTournamentsListFilter } from "@/lib/api/v2/params";
import { listTournamentsV2 } from "@/lib/api/v2/queries/tournaments";

export async function GET(request: Request) {
  return withApiV1(request, "/v2/tournaments", async () => {
    const filter = parseTournamentsListFilter(new URL(request.url).searchParams);
    return listTournamentsV2(filter);
  });
}

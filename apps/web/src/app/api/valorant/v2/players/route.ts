/**
 * GC-Stats - route
 *
 * Public API v2 endpoint: list players, filterable via query params.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePlayersListFilter } from "@/lib/api/v2/params";
import { listPlayersV2 } from "@/lib/api/v2/queries/players";

export async function GET(request: Request) {
  return withApiV1(request, "/v2/players", async () => {
    const filter = parsePlayersListFilter(new URL(request.url).searchParams);
    return listPlayersV2(filter);
  });
}

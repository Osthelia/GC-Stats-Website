/**
 * GC-Stats — route
 *
 * Public API v2 endpoint returning matches for a tournament, by id.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { parseTournamentMatchesFilter } from "@/lib/api/v2/params";
import { getTournamentMatchesV2 } from "@/lib/api/v2/queries/tournaments";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(request, "/v2/tournaments/:id/matches", async () => {
    const { id } = await params;
    const filter = parseTournamentMatchesFilter(new URL(request.url).searchParams);
    return getTournamentMatchesV2(parsePathId(id), filter);
  });
}

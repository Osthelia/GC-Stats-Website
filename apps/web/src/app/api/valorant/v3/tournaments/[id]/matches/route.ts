/**
 * GC-Stats — route
 *
 * Public API v3 endpoint returning a tournament's matches, by id.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { parseTournamentMatchesFilter } from "@/lib/api/v2/params";
import { getTournamentMatchesV2 } from "@/lib/api/v2/queries/tournaments";
import { withPhasesPaginated } from "@/lib/api/v3/queries/phases";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(request, "/v3/tournaments/:id/matches", async () => {
    const { id } = await params;
    const filter = parseTournamentMatchesFilter(new URL(request.url).searchParams);
    return withPhasesPaginated(await getTournamentMatchesV2(parsePathId(id), filter));
  });
}

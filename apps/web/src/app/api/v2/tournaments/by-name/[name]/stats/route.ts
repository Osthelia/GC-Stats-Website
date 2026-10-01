/**
 * GC-Stats — route
 *
 * Public API v2 endpoint returning aggregated stats for a tournament, by name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parseTournamentStatsFilter } from "@/lib/api/v2/params";
import { getTournamentStatsByNameV2 } from "@/lib/api/v2/queries/tournaments";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return withApiV1(request, "/v2/tournaments/by-name/:name/stats", async () => {
    const { name } = await params;
    const filter = parseTournamentStatsFilter(new URL(request.url).searchParams);
    return getTournamentStatsByNameV2(name, filter);
  });
}

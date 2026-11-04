/**
 * GC-Stats — route
 *
 * Public API v3 endpoint returning the swiss and round robin standings and match order of a tournament, by id.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId, parsePositiveIntParam } from "@/lib/api/v1/params";
import { getTournamentGroupsV3 } from "@/lib/api/v3/queries/groups";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(request, "/v3/tournaments/:id/groups", async () => {
    const { id } = await params;
    const phaseId = parsePositiveIntParam(new URL(request.url).searchParams, "phase_id");
    return getTournamentGroupsV3(parsePathId(id), phaseId);
  });
}

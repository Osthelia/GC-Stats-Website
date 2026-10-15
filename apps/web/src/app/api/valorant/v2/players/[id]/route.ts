/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: a single player's profile by id. Charges the
 * heavier TEAM_PLAYER_ENTITY_COST rate limit weight.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { getPlayerByIdV2 } from "@/lib/api/v2/queries/players";
import { TEAM_PLAYER_ENTITY_COST } from "@/lib/api/v2/rate-limit-costs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(
    request,
    "/v2/players/:id",
    async () => {
      const { id } = await params;
      return getPlayerByIdV2(parsePathId(id));
    },
    TEAM_PLAYER_ENTITY_COST,
  );
}

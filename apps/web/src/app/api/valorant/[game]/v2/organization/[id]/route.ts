/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: a single organization's profile by id. Charges the
 * heavier TEAM_PLAYER_ENTITY_COST rate limit weight.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { getOrganizationByIdV2 } from "@/lib/api/v2/queries/organizations";
import { TEAM_PLAYER_ENTITY_COST } from "@/lib/api/v2/rate-limit-costs";
import { gameFromParams } from "@/lib/game";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; game: string }> }) {
  const game = await gameFromParams(params);
  return withApiV1(
    request,
    "/v2/organization/:id",
    async () => {
      const { id } = await params;
      return getOrganizationByIdV2(game, parsePathId(id));
    },
    TEAM_PLAYER_ENTITY_COST,
  );
}

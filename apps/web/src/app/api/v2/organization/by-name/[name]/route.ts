/**
 * GC-Stats — route
 *
 * Public API v2 endpoint: organization search by name. Charges the heavier
 * TEAM_PLAYER_ENTITY_COST rate limit weight.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { searchOrganizationsByNameV2 } from "@/lib/api/v2/queries/organizations";
import { TEAM_PLAYER_ENTITY_COST } from "@/lib/api/v2/rate-limit-costs";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return withApiV1(
    request,
    "/v2/organization/by-name/:name",
    async () => {
      const { name } = await params;
      return searchOrganizationsByNameV2(name);
    },
    TEAM_PLAYER_ENTITY_COST,
  );
}

/**
 * GC-Stats — route
 *
 * Public API v1 endpoint: team search by name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { searchTeamsByName } from "@/lib/api/v1/queries/teams";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return withApiV1(request, "/v1/teams/by-name/:name", async () => {
    const { name } = await params;
    return searchTeamsByName(name);
  });
}

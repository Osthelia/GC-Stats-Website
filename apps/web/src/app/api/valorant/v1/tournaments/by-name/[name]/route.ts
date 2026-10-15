/**
 * GC-Stats — route
 *
 * Public API v1 endpoint: tournament search by name.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { searchTournamentsByName } from "@/lib/api/v1/queries/tournaments";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  return withApiV1(request, "/v1/tournaments/by-name/:name", async () => {
    const { name } = await params;
    return searchTournamentsByName(name);
  });
}

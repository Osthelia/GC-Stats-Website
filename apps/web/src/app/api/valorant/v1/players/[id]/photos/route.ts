/**
 * GC-Stats — route
 *
 * Public API v1 endpoint: a player's profile photo history.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { withApiV1 } from "@/lib/api/v1/handler";
import { parsePathId } from "@/lib/api/v1/params";
import { getPlayerPhotoHistory } from "@/lib/api/v1/queries/players";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiV1(request, "/v1/players/:id/photos", async () => {
    const { id } = await params;
    return getPlayerPhotoHistory(parsePathId(id));
  });
}

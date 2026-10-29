/**
 * GC-Stats - route
 *
 * OpenData table page: sorted, filtered and paginated public rows of a dataset.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { handleOpenDataBrowse } from "@/lib/opendata/handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  return handleOpenDataBrowse(request, dataset);
}

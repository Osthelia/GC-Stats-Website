/**
 * GC-Stats - route
 *
 * Public JSON endpoint mirroring the /about page's team section, so other
 * GC Stats projects can reuse it without scraping HTML.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { getAboutTeam } from "@/lib/about-data";

/** Public JSON mirror of /about's team section, so other GC Stats projects can reuse it without scraping the HTML page. */
export async function GET() {
  const team = await getAboutTeam();
  return NextResponse.json(team, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

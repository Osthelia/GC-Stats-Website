/**
 * GC-Stats - route
 *
 * Public JSON endpoint mirroring the /finance page's shared ledger, so
 * other GC Stats projects can reuse it without scraping HTML.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { getPublicFinanceEntries } from "@/lib/finance-ledger";

/** Public JSON mirror of /finance, so other GC Stats projects (e.g. static sites) can reuse the shared ledger without scraping the HTML page. */
export async function GET() {
  const entries = await getPublicFinanceEntries();
  return NextResponse.json(entries, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

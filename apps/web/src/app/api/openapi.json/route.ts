/**
 * GC-Stats - route
 *
 * Serves the generated OpenAPI document (`npm run generate:openapi`) for the
 * public API, so clients and doc tools can fetch it at /api/openapi.json.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import openapi from "../../../../openapi.json";

/** Public OpenAPI 3.1 document for the read-only stats API. */
export async function GET() {
  return NextResponse.json(openapi, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

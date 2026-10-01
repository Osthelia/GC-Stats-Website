/**
 * GC-Stats - route
 *
 * Backs the header's global search dropdown (components/search/global-search.tsx).
 * Plain JSON, not a server action, so the client can debounce/abort fetches
 * (AbortController) the way a Next Action call can't easily be cancelled.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { searchGlobal } from "@/lib/search";
import { getClientIp } from "@/lib/client-ip";
import { checkSearchThrottle } from "@/lib/search-throttle";

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  try {
    if (!(await checkSearchThrottle(ip))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  } catch (error) {
    console.warn("[search] Throttle check failed, allowing request", error);
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  // Same defaults as V1's header dropdown (SearchService::search()'s own defaults, perTypeLimit: 5, candidateLimit: 15).
  const results = await searchGlobal(q, { perTypeLimit: 5, candidateLimit: 15 });

  return NextResponse.json(results);
}

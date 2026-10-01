/**
 * GC-Stats - route
 *
 * Fired by components/page-view-tracker.tsx on every client-side navigation.
 * Fire-and-forget from the client's side, so never throw: swallow write
 * failures and always answer 204, the same "never block the page" contract
 * V1's LogPageView middleware had.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { NextResponse } from "next/server";
import { isTrackableUri, recordPageView } from "@/lib/track-page-view";
import { getClientIp } from "@/lib/client-ip";
import { checkPageViewThrottle } from "@/lib/page-view-throttle";

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  try {
    if (!(await checkPageViewThrottle(ip))) {
      return new NextResponse(null, { status: 204 });
    }
  } catch (error) {
    console.warn("[analytics] Throttle check failed, allowing view", error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const uri = (body as { uri?: unknown } | null)?.uri;
  if (!isTrackableUri(uri)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    // "x-vercel-ip-country" only exists on Vercel; "cf-ipcountry" is Cloudflare's
    // equivalent, set on every request once the site runs behind Cloudflare
    // Workers (target deployment, see SUIVI.md "CI/CD") — recordPageView falls
    // back to "UNK" if neither is present (local dev, other hosts).
    const countryCode = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
    await recordPageView(uri, countryCode);
  } catch (error) {
    console.warn("[analytics] Failed to record page view", error);
  }

  return new NextResponse(null, { status: 204 });
}

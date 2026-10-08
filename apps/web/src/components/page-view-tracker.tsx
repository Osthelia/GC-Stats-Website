/**
 * GC-Stats - page-view-tracker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Fires a beacon to /api/track-page-view on every client-side navigation,
 * feeding /admin/analytics. Mounted once in the root layout so it covers
 * every route group (site/admin/dashboard), mirroring V1's
 * App\Http\Middleware\LogPageView which tracked every successful page GET.
 * A client component rather than server-side tracking so the root layout
 * (site) keeps its static rendering (see [locale]/layout.tsx) instead of
 * being forced dynamic by reading headers()/pathname server-side.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/track-page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}

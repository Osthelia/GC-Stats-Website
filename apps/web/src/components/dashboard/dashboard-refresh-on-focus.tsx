/**
 * GC-Stats - dashboard-refresh-on-focus
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * `/dashboard/layout.tsx` (memberships/isAuthor/hasApiKey) only re-renders on
 * a hard navigation or an explicit router.refresh() — client side
 * transitions between dashboard pages reuse the mounted layout, so a grant
 * an admin makes elsewhere (author access, API key, org role) never reaches
 * an already open dashboard tab. Refreshing when the tab regains focus keeps
 * that window small without polling constantly in the background.
 */
export function DashboardRefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    let wasHidden = false;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        return;
      }
      if (wasHidden) {
        wasHidden = false;
        router.refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [router]);

  return null;
}

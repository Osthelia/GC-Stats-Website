/**
 * GC-Stats - use-match-time-filter
 *
 * Hook providing shared upcoming/past time filtering and client side
 * pagination for match-linked dashboard lists (stream links, VODs).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";

const PAGE_SIZE = 10;

/**
 * Shared "upcoming/all" or "past/all" time filter + client pagination for a
 * list of match-linked dashboard rows (stream links, VODs) — data is
 * already fully loaded (no server pagination on these lists, same tradeoff
 * as the dashboard news filters), this only filters/slices in memory. A row
 * with no known date (null — includes the migrated MySQL zero-date
 * sentinel, already normalized to null by the data layer) is never hidden
 * by the filter, only "all" vs. the default direction changes what's shown.
 */
export function useMatchTimeFilter<T>(items: T[], getScheduledAt: (item: T) => string | null, defaultFilter: "upcoming" | "past") {
  const [showAll, setShowAllState] = useState(false);
  const [page, setPage] = useState(1);

  const nowIso = new Date().toISOString();
  const filtered = showAll
    ? items
    : items.filter((item) => {
        const scheduledAt = getScheduledAt(item);
        if (scheduledAt === null) return true;
        return defaultFilter === "upcoming" ? scheduledAt >= nowIso : scheduledAt < nowIso;
      });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  function setShowAll(value: boolean) {
    setShowAllState(value);
    setPage(1);
  }

  return { showAll, setShowAll, page: clampedPage, setPage, totalPages, pageItems, totalCount: filtered.length };
}

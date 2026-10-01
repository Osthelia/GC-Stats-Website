/**
 * GC-Stats - match-time-filter-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { cn } from "@/lib/utils";

/** UI half of useMatchTimeFilter (the toggle + pager), shared between OrgStreamsPanel's linked-matches list and OrgVodsPanel's VOD list. */
export function MatchTimeFilterBar({
  showAll,
  onShowAllChange,
  defaultFilterLabel,
  allLabel,
  page,
  totalPages,
  onPageChange,
  previousLabel,
  nextLabel,
  pageOfLabel,
}: {
  showAll: boolean;
  onShowAllChange: (value: boolean) => void;
  defaultFilterLabel: string;
  allLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  pageOfLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-lg border p-0.5 text-xs">
        <button
          type="button"
          onClick={() => onShowAllChange(false)}
          className={cn("rounded-md px-2.5 py-1 font-medium transition-colors", !showAll ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {defaultFilterLabel}
        </button>
        <button
          type="button"
          onClick={() => onShowAllChange(true)}
          className={cn("rounded-md px-2.5 py-1 font-medium transition-colors", showAll ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {allLabel}
        </button>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-md px-2 py-1 font-medium transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
            {previousLabel}
          </button>
          <span>{pageOfLabel}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md px-2 py-1 font-medium transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

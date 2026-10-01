/**
 * GC-Stats - filter-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { ReactNode } from "react";
import { FilterBarMobileToggle } from "@/components/filters/filter-bar-mobile-toggle";

/**
 * Shared card wrapper for a page's filter controls (tournaments/matches
 * listings) — groups the filter rows visually instead of leaving pills
 * floating loose in the page, per CLAUDE.md reusable-components rule.
 */
export function FilterBar({
  children,
  mobileToggle,
}: {
  children: ReactNode;
  mobileToggle?: { label: string; activeCount: number };
}) {
  if (mobileToggle) {
    return (
      <FilterBarMobileToggle
        label={mobileToggle.label}
        activeCount={mobileToggle.activeCount}
      >
        <div className="flex flex-col divide-y divide-neutral-800/70 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface)] px-4">
          {children}
        </div>
      </FilterBarMobileToggle>
    );
  }
  return (
    <div className="mb-6 flex flex-col divide-y divide-neutral-800/70 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface)] px-4">
      {children}
    </div>
  );
}

export function FilterBarRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-3.5 last:pb-3.5">
      <span className="w-24 flex-none text-xs font-semibold uppercase tracking-wide text-[var(--gcs-text-tertiary)]">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * GC-Stats - filter-bar-mobile-toggle
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type ReactNode } from "react";

/** Below `sm`, folds the filter rows behind a "Filters (n)" button so results show on the first screen. */
export function FilterBarMobileToggle({
  label,
  activeCount,
  children,
}: {
  label: string;
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-neutral-800/70 bg-[var(--gcs-surface)] px-4 py-3 text-left text-[13px] font-semibold text-[var(--gcs-text)] transition-colors active:bg-[var(--gcs-hover)] sm:hidden"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="flex-none text-[var(--gcs-text-tertiary)]"
        >
          <path d="M4 6h16M7 12h10M11 18h2" />
        </svg>
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e4ae22] px-1 text-[10px] font-black text-[#0e0e0e]">
            {activeCount}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`ml-auto flex-none text-[var(--gcs-text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={`${open ? "mt-2 block" : "hidden"} sm:mt-0 sm:block`}>
        {children}
      </div>
    </div>
  );
}

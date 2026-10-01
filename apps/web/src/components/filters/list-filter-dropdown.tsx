/**
 * GC-Stats - list-filter-dropdown
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Public-site list filter — a styled dropdown whose options are links that
 * change a query param (?region=..., ?category=..., ...), server-rendering
 * the filtered list on navigation rather than managing state client-side.
 * Reusable across any public list page (tournaments, and future teams/
 * players lists) — CLAUDE.md forbids both the native `<select>` and
 * reinventing this per page.
 */
export function ListFilterDropdown({
  label,
  defaultLabel,
  defaultHref,
  activeLabel,
  options,
}: {
  label: string;
  defaultLabel: string;
  /** Href for clearing the filter — hrefs are built server-side (this is a Client Component, functions can't cross that boundary as props). */
  defaultHref: string;
  /** Label of the currently selected option, or null when unset (shows defaultLabel). */
  activeLabel: string | null;
  options: { value: string; label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 ml-1 block text-[9px] font-black tracking-[0.3em] text-neutral-600 uppercase">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-w-[150px] items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] px-4 py-3 transition-colors hover:border-[#e4ae22]/30 hover:bg-[var(--gcs-hover)]"
      >
        <span className={`text-[10px] font-black tracking-widest uppercase ${activeLabel ? "text-[#e4ae22]" : "text-neutral-500"}`}>{activeLabel ?? defaultLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`flex-none text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="listbox" className="absolute z-50 mt-2 max-h-72 w-max min-w-full overflow-y-auto rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] shadow-2xl">
          <Link
            href={defaultHref}
            onClick={() => setOpen(false)}
            role="option"
            aria-selected={!activeLabel}
            className="block px-4 py-2.5 text-[10px] font-bold text-neutral-500 uppercase transition-colors hover:bg-[var(--gcs-hover)] hover:text-neutral-50"
          >
            {defaultLabel}
          </Link>
          {options.map((o) => (
            <Link
              key={o.value}
              href={o.href}
              onClick={() => setOpen(false)}
              role="option"
              aria-selected={activeLabel === o.label}
              className={`block px-4 py-2.5 text-[10px] font-bold whitespace-nowrap uppercase transition-colors hover:bg-[var(--gcs-hover)] hover:text-neutral-50 ${
                activeLabel === o.label ? "bg-[var(--gcs-hover)] text-[#e4ae22]" : "text-neutral-400"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

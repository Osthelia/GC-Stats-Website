/**
 * GC-Stats - public-optional-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Styled single-choice dropdown for a static option list where no selection
 * is a valid state (shows `placeholder`, e.g. "All sides") — distinct from
 * PublicSelect (always has a concrete value, no placeholder) so that
 * component's existing callers (always a definite value) keep a non-null
 * contract instead of every caller having to guard against null.
 */
export function PublicOptionalSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  placeholder: string;
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

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-left text-[13.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60"
      >
        <span className={selected ? "" : "text-neutral-500"}>{selected ? selected.label : placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-neutral-500">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 max-h-56 w-full min-w-[160px] overflow-y-auto rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] p-1 shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-white/5 ${
                value === o.value ? "bg-white/5 text-neutral-50" : "text-neutral-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

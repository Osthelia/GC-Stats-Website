/**
 * GC-Stats - public-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";

/** Generic styled single-choice dropdown for the public site — CLAUDE.md forbids the native `<select>` for closed lists. */
export function PublicSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
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
        className="flex min-w-[140px] items-center justify-between gap-2 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-left text-[13.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-neutral-500">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 max-h-56 w-max min-w-full overflow-y-auto rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] p-1 shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-white/5 ${
                o.value === value ? "bg-white/5 text-neutral-50" : "text-neutral-300"
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

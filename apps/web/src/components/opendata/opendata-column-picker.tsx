/**
 * GC-Stats - opendata-column-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Columns3 } from "lucide-react";

/** Styled multi choice dropdown toggling the visible explorer columns. */
export function OpenDataColumnPicker({
  label,
  showAllLabel,
  resetLabel,
  columns,
  isVisible,
  onToggle,
  onShowAll,
  onReset,
}: {
  label: string;
  showAllLabel: string;
  resetLabel: string;
  columns: { key: string; label: string }[];
  isVisible: (key: string) => boolean;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const visibleCount = columns.filter((c) => isVisible(c.key)).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-[13px] text-neutral-200 transition-all hover:bg-[var(--gcs-hover)] active:scale-[0.97] aria-expanded:border-[#e4ae22]/60"
      >
        <Columns3 className="size-4 text-neutral-400" />
        {label}
        <span className="rounded bg-white/5 px-1.5 text-[11px] tabular-nums text-neutral-400">
          {visibleCount}/{columns.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] p-1 shadow-xl">
          <div className="flex gap-1 border-b border-neutral-800 p-1 pb-1.5">
            <button type="button" onClick={onShowAll} className="flex-1 rounded-md px-2 py-1 text-[12px] text-neutral-300 transition-colors hover:bg-white/5 active:bg-white/10">
              {showAllLabel}
            </button>
            <button type="button" onClick={onReset} className="flex-1 rounded-md px-2 py-1 text-[12px] text-neutral-300 transition-colors hover:bg-white/5 active:bg-white/10">
              {resetLabel}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto pt-1">
            {columns.map((c) => {
              const checked = isVisible(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  // The table needs at least one column.
                  disabled={checked && visibleCount === 1}
                  onClick={() => onToggle(c.key)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-neutral-300 transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-40"
                >
                  <span className={`flex size-4 items-center justify-center rounded-[4px] border ${checked ? "border-[#e4ae22] bg-[#e4ae22] text-[#0e0e0e]" : "border-neutral-600"}`}>
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

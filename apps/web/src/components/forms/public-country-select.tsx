/**
 * GC-Stats - public-country-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { countryList, countryName, countryFlagClass } from "@/lib/countries";
import type { AppLocale } from "@/i18n/routing";

/**
 * Public-site custom country picker — CLAUDE.md forbids the native
 * `<select>` for closed choices. Kept separate from
 * components/admin/country-select.tsx per the admin/public component split
 * (different visual language), but reuses the same country data source.
 */
export function PublicCountrySelect({
  id,
  value,
  onChange,
  placeholder,
  clearLabel,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
  clearLabel: string;
  invalid?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const countries = useMemo(() => countryList(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query
    ? countries.filter((c) => c[locale].toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()))
    : countries;

  const selectedLabel = countryName(value || null, locale);
  const selectedFlag = countryFlagClass(value || null);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-left text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60 aria-[invalid]:border-[#e08585]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedFlag && <span className={`fi ${selectedFlag} shrink-0 rounded-[2px]`} style={{ width: 16, height: 11 }} />}
          <span className={selectedLabel ? "" : "text-neutral-500"}>{selectedLabel ?? placeholder}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-neutral-500">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] shadow-xl">
          <div className="border-b border-neutral-800 p-2">
            <input
              autoFocus
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-black/25 px-2.5 py-1.5 text-[13.5px] text-neutral-50 outline-none focus:border-[#e4ae22]/60"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13.5px] text-neutral-500 transition-colors hover:bg-white/5"
            >
              {clearLabel}
            </button>
            {filtered.map((c) => {
              const flag = countryFlagClass(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-white/5 ${
                    value === c.code ? "bg-white/5 text-neutral-50" : "text-neutral-300"
                  }`}
                >
                  {flag && <span className={`fi ${flag} shrink-0 rounded-[2px]`} style={{ width: 16, height: 11 }} />}
                  <span className="truncate">{c[locale]}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-2.5 py-1.5 text-[13.5px] text-neutral-500">—</p>}
          </div>
        </div>
      )}
    </div>
  );
}

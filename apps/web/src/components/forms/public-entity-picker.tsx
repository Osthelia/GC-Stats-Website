/**
 * GC-Stats - public-entity-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { countryName } from "@/lib/countries";
import type { SearchResultType } from "@/lib/search";

/**
 * Searchable team/player/tournament picker for the public site — hits the same
 * `/api/search` route as the header's global search (typo-tolerant,
 * public, no admin permission needed) rather than the admin-only
 * searchPeople/searchTeams server actions (components/admin/{person,team}-picker.tsx),
 * which require staff access.
 */
export function PublicEntityPicker({
  type,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  excludeId,
}: {
  type: Extract<SearchResultType, "team" | "player" | "tournament">;
  value: { id: number; label: string } | null;
  onChange: (entity: { id: number; label: string } | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  /** Excludes this id from the results, e.g. the team already picked on the opposite side of a head to head. */
  excludeId?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; title: string; countryCode: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          if (id !== requestId.current) return;
          const rows = ((data as Record<string, unknown> | null)?.[type] ?? []) as {
            id: number;
            title: string;
            countryCode: string | null;
          }[];
          setResults(rows);
          setLoading(false);
        })
        .catch(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, open, type]);

  const visibleResults = excludeId != null ? results.filter((r) => r.id !== excludeId) : results;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3 py-2 text-left text-[13.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60"
      >
        <span className={value ? "" : "text-neutral-500"}>{value ? value.label : placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-neutral-500">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] shadow-xl">
          <div className="border-b border-neutral-800 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-neutral-700 bg-black/25 px-2.5 py-1.5 text-[13.5px] text-neutral-50 outline-none focus:border-[#e4ae22]/60"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {loading && <p className="px-2.5 py-1.5 text-[13px] text-neutral-500">…</p>}
            {!loading &&
              visibleResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onChange({ id: r.id, label: r.title });
                    setQuery("");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors hover:bg-white/5 ${
                    value?.id === r.id ? "bg-white/5 text-neutral-50" : "text-neutral-300"
                  }`}
                >
                  <span className="truncate">{r.title}</span>
                  <span className="shrink-0 text-[11px] text-neutral-500">{countryName(r.countryCode, "en") ?? ""}</span>
                </button>
              ))}
            {!loading && visibleResults.length === 0 && <p className="px-2.5 py-1.5 text-[13px] text-neutral-500">{noResultsLabel}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

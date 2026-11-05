/**
 * GC-Stats - list-filter-dropdown
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useRouter } from "@/i18n/navigation";

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
  search,
}: {
  label: string;
  defaultLabel: string;
  /** Href for clearing the filter — hrefs are built server-side (this is a Client Component, functions can't cross that boundary as props). */
  defaultHref: string;
  /** Label of the currently selected option, or null when unset (shows defaultLabel). */
  activeLabel: string | null;
  options: { value: string; label: string; href: string }[];
  /** Adds a search input at the top of the list (placeholder and empty-state labels). */
  search?: { placeholder: string; noResult: string };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = normalizedQuery ? options.filter((o) => o.label.toLowerCase().includes(normalizedQuery)) : options;

  // The "all" row comes first, then the options that match the search.
  const rows = [{ href: defaultHref }, ...visibleOptions];

  // Keeps the highlighted row in view while the arrow keys move it.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  // Closing gives the focus back to the button, or Tab from the search box would start again at the top of the page.
  function closeToTrigger() {
    close();
    triggerRef.current?.focus();
  }

  // Where the highlight starts for a search: on the first match, so Enter opens it. The "all" row only when nothing matches.
  function startingRow(text: string): number {
    const needle = text.trim().toLowerCase();
    return needle && options.some((o) => o.label.toLowerCase().includes(needle)) ? 1 : 0;
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => Math.min(Math.max(a + (event.key === "ArrowDown" ? 1 : -1), 0), rows.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) router.push(row.href);
      close();
    } else if (event.key === "Escape" || event.key === "Tab") {
      closeToTrigger();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 ml-1 block text-[9px] font-black tracking-[0.3em] text-neutral-600 uppercase">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setActive(0);
          if (open) close();
          else setOpen(true);
        }}
        onKeyDown={(event) => {
          // A typed letter or digit opens the list with it as the search. Space is left to the button, which opens the list too.
          if (!search || event.key.length !== 1 || event.key === " " || event.ctrlKey || event.metaKey || event.altKey) return;
          event.preventDefault();
          setQuery(event.key);
          setActive(startingRow(event.key));
          setOpen(true);
        }}
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
        <div ref={listRef} id={listId} role="listbox" className="absolute z-50 mt-2 max-h-72 w-max min-w-full overflow-y-auto rounded-xl border border-neutral-800 bg-[var(--gcs-surface-2)] shadow-2xl">
          {search && (
            <div className="sticky top-0 border-b border-neutral-800 bg-[var(--gcs-surface-2)] p-2">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(startingRow(e.target.value));
                }}
                onKeyDown={onSearchKeyDown}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={`${listId}-${active}`}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                className="w-full rounded-lg border border-neutral-800 bg-[var(--gcs-surface)] px-3 py-2 text-[10px] font-bold text-neutral-50 uppercase outline-none transition-colors placeholder:text-neutral-600 focus:border-[#e4ae22]/50"
              />
            </div>
          )}
          <Link
            id={`${listId}-0`}
            href={defaultHref}
            onClick={close}
            onMouseEnter={() => setActive(0)}
            role="option"
            aria-selected={!activeLabel}
            data-active={active === 0}
            className="block px-4 py-2.5 text-[10px] font-bold text-neutral-500 uppercase transition-colors hover:bg-[var(--gcs-hover)] hover:text-neutral-50 data-[active=true]:bg-[var(--gcs-hover)] data-[active=true]:text-neutral-50"
          >
            {defaultLabel}
          </Link>
          {search && visibleOptions.length === 0 && <p className="px-4 py-2.5 text-[10px] font-bold text-neutral-600 uppercase">{search.noResult}</p>}
          {visibleOptions.map((o, i) => (
            <Link
              key={o.value}
              id={`${listId}-${i + 1}`}
              href={o.href}
              onClick={close}
              onMouseEnter={() => setActive(i + 1)}
              role="option"
              aria-selected={activeLabel === o.label}
              data-active={active === i + 1}
              className={`block px-4 py-2.5 text-[10px] font-bold whitespace-nowrap uppercase transition-colors hover:bg-[var(--gcs-hover)] hover:text-neutral-50 data-[active=true]:bg-[var(--gcs-hover)] data-[active=true]:text-neutral-50 ${
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

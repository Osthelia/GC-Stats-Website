/**
 * GC-Stats - map-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnchorRect } from "@/hooks/use-anchor-rect";
import { MAP_OPTIONS, MAP_UNKNOWN } from "@/lib/valorant-maps";

/**
 * 1:1 port of V1's veto map picker (admin/matches/veto.blade.php's Alpine.js
 * `openMap`/`filteredMaps`/`usedMaps`) — a searchable dropdown, positioned
 * the same portal way as TeamPicker, whose list excludes whatever map is
 * already selected on another row of the same veto (a map can only be
 * picked/banned once — "Unknown" is exempt, it isn't a real map slot).
 */
const CLEAR = "none";

export function MapPicker({
  value,
  onChange,
  excludedMaps,
  placeholder,
  clearLabel,
  unknownLabel,
  searchPlaceholder,
  noResultsLabel,
  disabled,
  allowClear = true,
}: {
  value: string | null;
  onChange: (mapName: string) => void;
  excludedMaps: string[];
  placeholder: string;
  /** Only used when `allowClear` is true. */
  clearLabel?: string;
  unknownLabel: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  disabled?: boolean;
  /** False for a required field (map creation/edit) — "Unknown" already covers "not decided yet", so no separate empty state is offered. */
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rect = useAnchorRect(open, triggerRef);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const excluded = new Set(excludedMaps.filter((m) => m !== MAP_UNKNOWN));
  const q = query.trim().toLowerCase();
  const results = MAP_OPTIONS.filter((m) => (!excluded.has(m) || m === value) && (q.length === 0 || m.toLowerCase().includes(q)));
  const options = allowClear ? [CLEAR, ...results] : results;

  function select(m: string) {
    onChange(m);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1 >= options.length ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 < 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) select(options[activeIndex]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setQuery("");
          setActiveIndex(-1);
          setOpen((o) => !o);
        }}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? (value === MAP_UNKNOWN ? unknownLabel : value) : placeholder}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open &&
        mounted &&
        rect &&
        createPortal(
          <div
            ref={contentRef}
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 180) }}
            className="z-50 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <div className="p-1.5">
              <input
                autoFocus
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={onKeyDown}
                className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring"
              />
            </div>
            <div role="listbox" className="max-h-56 overflow-y-auto p-1">
              {allowClear && (
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === 0}
                  onClick={() => select(CLEAR)}
                  className={cn(
                    "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    activeIndex === 0 && "bg-accent text-accent-foreground"
                  )}
                >
                  {clearLabel}
                </button>
              )}
              {results.map((m, i) => {
                const optionIndex = allowClear ? i + 1 : i;
                return (
                  <button
                    key={m}
                    type="button"
                    role="option"
                    aria-selected={value === m}
                    onClick={() => select(m)}
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground",
                      (value === m || activeIndex === optionIndex) && "bg-accent/60",
                      activeIndex === optionIndex && "bg-accent text-accent-foreground"
                    )}
                  >
                    {m === MAP_UNKNOWN ? unknownLabel : m}
                  </button>
                );
              })}
              {results.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">{noResultsLabel}</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

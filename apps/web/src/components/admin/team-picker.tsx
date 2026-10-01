/**
 * GC-Stats - team-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { countryName } from "@/lib/countries";
import { useAnchorRect } from "@/hooks/use-anchor-rect";
import { searchTeams } from "@/actions/admin-players";
import type { TeamPickerResult } from "@/lib/team-search";
import type { AppLocale } from "@/i18n/routing";

/**
 * Searchable team dropdown — mirrors PersonPicker (see that file for the
 * portal/positioning rationale) but for the player-side "add team history"
 * flow, backed by searchTeams instead of searchPeople.
 */
export function TeamPicker({
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  search = searchTeams,
}: {
  value: { id: number; name: string } | null;
  onChange: (team: { id: number; name: string } | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  /** Defaults to the admin-gated searchTeams action — the team merge target picker passes its own source-excluding search instead. */
  search?: (query: string) => Promise<TeamPickerResult[]>;
}) {
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamPickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const rect = useAnchorRect(open, triggerRef);
  const listboxId = useRef(`team-picker-listbox-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => setMounted(true), []);
  useEffect(() => setHighlightedIndex(-1), [results]);

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

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setLoading(true);
    const timeout = setTimeout(() => {
      search(query).then((rows) => {
        if (id === requestId.current) {
          setResults(rows);
          setLoading(false);
        }
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, open]);

  function selectResult(r: TeamPickerResult) {
    onChange({ id: r.id, name: r.name });
    setQuery("");
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => (results.length === 0 ? -1 : Math.min(i + 1, results.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => (results.length === 0 ? -1 : Math.max(i - 1, 0)));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex >= 0 && results[highlightedIndex]) selectResult(results[highlightedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? value.name : placeholder}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open &&
        mounted &&
        rect &&
        createPortal(
          <div
            ref={contentRef}
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 224) }}
            className="z-50 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <div className="p-1.5">
              <Input
                autoFocus
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-${highlightedIndex}` : undefined}
              />
            </div>
            <div id={listboxId} role="listbox" className="max-h-56 overflow-y-auto p-1">
              {loading && (
                <div className="flex items-center justify-center py-3">
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading &&
                results.map((r, index) => (
                  <button
                    key={r.id}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={value?.id === r.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectResult(r)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      (value?.id === r.id || highlightedIndex === index) && "bg-accent/60"
                    )}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{countryName(r.countryCode, locale) ?? ""}</span>
                  </button>
                ))}
              {!loading && results.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{noResultsLabel}</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

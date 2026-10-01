/**
 * GC-Stats - entity-single-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, Loader2Icon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAnchorRect } from "@/hooks/use-anchor-rect";
import type { EntityOption } from "@/components/dashboard/news/entity-multi-picker";

/**
 * Single-select sibling of EntityMultiPicker (same portal/search idiom),
 * backs the news article byline (author) field, the one dashboard picker so
 * far that only ever holds one value instead of a list.
 */
export function EntitySinglePicker({
  value,
  onChange,
  search,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  clearLabel,
}: {
  value: EntityOption | null;
  onChange: (next: EntityOption | null) => void;
  search: (query: string) => Promise<EntityOption[]>;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  clearLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const rect = useAnchorRect(open, triggerRef);
  const listboxId = useRef(`entity-single-picker-listbox-${Math.random().toString(36).slice(2)}`).current;

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
  }, [query, open, search]);

  function selectResult(r: EntityOption) {
    onChange(r);
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
    <div className="flex items-center gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? value.label : placeholder}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {value && (
        <button type="button" onClick={() => onChange(null)} aria-label={clearLabel} className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <XIcon className="size-3.5" />
        </button>
      )}

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
                    <span className="truncate">{r.label}</span>
                  </button>
                ))}
              {!loading && results.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{noResultsLabel}</p>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * GC-Stats - entity-multi-picker
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAnchorRect } from "@/hooks/use-anchor-rect";

export type EntityOption = { id: number; label: string };

/**
 * Generic multi-select search dropdown (chips + typeahead), same
 * portal/positioning idiom as TeamPicker/PersonPicker (see those files) but
 * multi-select, backs the news article relations picker (teams/people/
 * tournaments), which all share the exact same interaction, just a
 * different search function and already-selected list.
 */
export function EntityMultiPicker({
  value,
  onChange,
  search,
  placeholder,
  noResultsLabel,
  removeLabel,
}: {
  value: EntityOption[];
  onChange: (next: EntityOption[]) => void;
  search: (query: string) => Promise<EntityOption[]>;
  placeholder: string;
  noResultsLabel: string;
  removeLabel: string;
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
  const listboxId = useRef(`entity-multi-picker-listbox-${Math.random().toString(36).slice(2)}`).current;

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

  function addOption(option: EntityOption) {
    if (value.some((v) => v.id === option.id)) return;
    onChange([...value, option]);
  }

  function removeOption(id: number) {
    onChange(value.filter((v) => v.id !== id));
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
      if (highlightedIndex >= 0 && results[highlightedIndex]) addOption(results[highlightedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v.id} variant="secondary" className="gap-1 pr-1">
              {v.label}
              <button type="button" onClick={() => removeOption(v.id)} aria-label={removeLabel} className="rounded-sm p-0.5 hover:bg-foreground/10">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm text-muted-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <span className="truncate">{placeholder}</span>
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
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-${highlightedIndex}` : undefined}
              />
            </div>
            <div id={listboxId} role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto p-1">
              {loading && (
                <div className="flex items-center justify-center py-3">
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading &&
                results.map((r, index) => {
                  const selected = value.some((v) => v.id === r.id);
                  return (
                    <button
                      key={r.id}
                      id={`${listboxId}-${index}`}
                      role="option"
                      aria-selected={selected}
                      type="button"
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => addOption(r)}
                      disabled={selected}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50",
                        (selected || highlightedIndex === index) && "bg-accent/60"
                      )}
                    >
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              {!loading && results.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{noResultsLabel}</p>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

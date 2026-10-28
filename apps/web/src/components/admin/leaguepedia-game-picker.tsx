/**
 * GC-Stats - leaguepedia-game-picker
 *
 * Searchable dropdown for a Leaguepedia game. The options are already loaded, so the filter runs in the
 * browser (the same portaled pattern as OrganizationPicker, without the server search).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAnchorRect } from "@/hooks/use-anchor-rect";

export interface LeaguepediaPickerOption {
  id: string;
  label: string;
  disabled: boolean;
}

export function LeaguepediaGamePicker({
  id,
  value,
  options,
  onChange,
  placeholder,
  noneLabel,
  searchPlaceholder,
  noResultsLabel,
}: {
  id?: string;
  /** The chosen option's id, or null for none. */
  value: string | null;
  options: LeaguepediaPickerOption[];
  onChange: (id: string | null) => void;
  placeholder: string;
  noneLabel: string;
  searchPlaceholder: string;
  noResultsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  // Keeps the highlighted row in view while the arrow keys move it.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const label = options.find((o) => o.id === value)?.label ?? null;
  const needle = query.trim().toLowerCase();
  const matches = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const rows: { id: string | null; label: string; disabled: boolean }[] = [{ id: null, label: noneLabel, disabled: false }, ...matches];

  // Closing gives the focus back to the select. Otherwise the search box unmounts with the focus, and Tab starts again at the top of the page.
  function closeToTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(next: string | null) {
    onChange(next);
    setQuery("");
    closeToTrigger();
  }

  // The row the arrow keys land on: the next one that can be chosen, or the current one when there is none.
  function nextEnabled(from: number, delta: 1 | -1): number {
    for (let i = from + delta; i >= 0 && i < rows.length; i += delta) {
      if (!rows[i]!.disabled) return i;
    }
    return from;
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(nextEnabled(active, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row && !row.disabled) choose(row.id);
    } else if (event.key === "Escape") {
      closeToTrigger();
    } else if (event.key === "Tab") {
      // The list is portaled to the end of the page, so Tab from its search box would skip the draft. Give the focus back
      // to the select without preventing the default, so the browser moves on from there to the next select.
      closeToTrigger();
    }
  }

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => {
          setActive(0);
          setOpen((o) => !o);
        }}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <span className={cn("truncate", !label && "text-muted-foreground")}>{label ?? placeholder}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open &&
        mounted &&
        rect &&
        createPortal(
          <div
            ref={contentRef}
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 288) }}
            className="z-50 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <div className="p-1.5">
              <Input
                autoFocus
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={`${listId}-${active}`}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
              />
            </div>
            <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
              {rows.map((row, index) => (
                <button
                  key={row.id ?? "none"}
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  disabled={row.disabled}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(row.id)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm disabled:pointer-events-none disabled:opacity-50",
                    active === index ? "bg-accent text-accent-foreground" : value === row.id && "bg-accent/60"
                  )}
                >
                  <span className="truncate">{row.label}</span>
                </button>
              ))}
              {matches.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{noResultsLabel}</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

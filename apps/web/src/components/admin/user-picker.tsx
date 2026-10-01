/**
 * GC-Stats - user-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAnchorRect } from "@/hooks/use-anchor-rect";
import { searchUsersForLink, type UserPickerResult } from "@/actions/admin-players";

/** Searchable site-account dropdown — same portaled pattern as PersonPicker/TeamPicker, for the player "linked account" flow. */
export function UserPicker({
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  search = searchUsersForLink,
}: {
  value: { id: string; username: string | null } | null;
  onChange: (user: { id: string; username: string | null } | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  /** Defaults to the admin-gated searchUsersForLink action — callers with their own permission scope (e.g. /dashboard) pass their own search instead. */
  search?: (query: string) => Promise<UserPickerResult[]>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
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

  const label = value ? (value.username ?? value.id) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
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
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 224) }}
            className="z-50 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <div className="p-1.5">
              <Input autoFocus placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {loading && (
                <div className="flex items-center justify-center py-3">
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading &&
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onChange({ id: r.id, username: r.username });
                      setQuery("");
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      value?.id === r.id && "bg-accent/60"
                    )}
                  >
                    <span className="truncate">{r.username ?? r.id}</span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground">{r.email ?? ""}</span>
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

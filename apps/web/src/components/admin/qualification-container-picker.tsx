/**
 * GC-Stats - qualification-container-picker
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
import { searchQualificationDestinationContainers } from "@/actions/admin-bracket-qualifications";
import type { QualificationContainerSearchResult } from "@/lib/admin-bracket-qualifications";

/** Searchable, cross-tournament container picker for a qualification rule's destination — mirrors TeamPicker's portal/positioning pattern (see that file). A rule can advance an entrant into a different tournament entirely (e.g. regional -> major), so this isn't scoped to the current tournament. */
export function QualificationContainerPicker({
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
}: {
  value: { id: number; name: string; stageName: string; tournamentName: string } | null;
  onChange: (container: QualificationContainerSearchResult | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QualificationContainerSearchResult[]>([]);
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
      searchQualificationDestinationContainers(query).then((rows) => {
        if (id === requestId.current) {
          setResults(rows);
          setLoading(false);
        }
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? `${value.tournamentName} · ${value.stageName} · ${value.name}` : placeholder}</span>
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
                      onChange(r);
                      setQuery("");
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      value?.id === r.id && "bg-accent/60"
                    )}
                  >
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.tournamentName} · {r.stageName}
                    </span>
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

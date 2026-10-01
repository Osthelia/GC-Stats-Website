/**
 * GC-Stats - country-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { ChevronDownIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { countryList, countryName } from "@/lib/countries";
import { useAnchorRect } from "@/hooks/use-anchor-rect";
import { CountryFlag } from "@/components/admin/country-flag";
import type { AppLocale } from "@/i18n/routing";

/**
 * Portaled to document.body (see useAnchorRect / PersonPicker) rather than
 * an inline `position: absolute` popup — an inline popup stayed inside its
 * row's own DOM subtree and could shove the row around the moment it opened.
 */
export function CountrySelect({
  id,
  value,
  onChange,
  placeholder,
  clearLabel,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
  clearLabel: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const countries = useMemo(() => countryList(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
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

  const filtered = query
    ? countries.filter((c) => c[locale].toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()))
    : countries;

  const selectedLabel = countryName(value || null, locale);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-[invalid]:border-destructive aria-[invalid]:ring-3 aria-[invalid]:ring-destructive/20 dark:bg-input/30",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CountryFlag code={value || null} className="size-3.5" />
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>{selectedLabel ?? placeholder}</span>
        </span>
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
              <Input autoFocus placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {clearLabel}
              </button>
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    value === c.code && "bg-accent/60"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CountryFlag code={c.code} className="size-3.5" />
                    <span className="truncate">{c[locale]}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.code}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">—</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

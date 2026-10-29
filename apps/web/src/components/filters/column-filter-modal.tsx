/**
 * GC-Stats - column-filter-modal
 *
 * "Filter" button + modal shared by the public tables (tournament/team/player
 * stats, OpenData explorer): one row per filter, each picking any column and a
 * value, several filters active at once. Columns may restrict their value to a
 * list (rendered as a dropdown) or to an integer.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { INTEGER_FILTER_PATTERN } from "@/lib/column-filter";

export type ColumnFilter = { columnKey: string; value: string };

export type ColumnFilterColumn = {
  key: string;
  label: string;
  /** Value picked from this list instead of typed. */
  options?: { value: string; label: string }[];
  /** Typed value must be a whole number. */
  integer?: boolean;
};

export type ColumnFilterLabels = {
  button: string;
  title: string;
  columnLabel: string;
  valueLabel: string;
  valuePlaceholder: string;
  addAnother: string;
  apply: string;
  clear: string;
  /** Shown under an integer column holding something else. */
  integerRequired?: string;
};

type FilterRow = ColumnFilter & { key: number };

let nextFilterRowKey = 0;

export const COLUMN_FILTER_MAX_LENGTH = 100;

function isRowInvalid(row: FilterRow, columns: ColumnFilterColumn[]): boolean {
  const column = columns.find((c) => c.key === row.columnKey);
  const value = row.value.trim();
  return !!column?.integer && value !== "" && !INTEGER_FILTER_PATTERN.test(value);
}

function FilterDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLabel = options.find((o) => o.value === value)?.label;

  // Portalled at fixed coordinates so the modal's scrolling list never clips the menu.
  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setMenuRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative min-w-0 flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-800 px-3 py-2.5 text-left transition-colors hover:border-[#e4ae22]/30 active:bg-white/[0.03]"
        style={{ background: "var(--gcs-surface-2)" }}
      >
        <span className={`truncate text-[12px] font-bold ${activeLabel ? "text-neutral-200" : "text-neutral-500"}`}>{activeLabel ?? placeholder ?? ""}</span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`flex-none text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="fixed z-[60] max-h-56 overflow-y-auto rounded-xl border border-neutral-800 shadow-2xl"
            style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width, background: "var(--gcs-surface-2)" }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={value === o.value}
                className={`block w-full truncate px-3 py-2 text-left text-[12px] font-bold transition-colors hover:bg-[var(--gcs-hover)] active:bg-white/[0.06] ${value === o.value ? "text-[#e4ae22]" : "text-neutral-300"}`}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Trigger button, highlighted with a counter while filters are active. */
export function ColumnFilterButton({ label, activeCount, onClick }: { label: string; activeCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-black tracking-wider uppercase transition-colors hover:bg-white/[0.06] active:scale-[0.97]"
      style={activeCount > 0 ? { background: "rgba(228,174,34,0.12)", color: "#e4ae22" } : undefined}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M4 6h16M7 12h10M11 18h2" />
      </svg>
      {label}
      {activeCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-black" style={{ background: "#e4ae22", color: "#0b0b0c" }}>
          {activeCount}
        </span>
      )}
    </button>
  );
}

/** Mount only while open: the rows are copied from `activeFilters` at mount. */
export function ColumnFilterModal({
  onClose,
  columns,
  activeFilters,
  onApply,
  labels,
}: {
  onClose: () => void;
  columns: ColumnFilterColumn[];
  activeFilters: ColumnFilter[];
  onApply: (filters: ColumnFilter[]) => void;
  labels: ColumnFilterLabels;
}) {
  const [rows, setRows] = useState<FilterRow[]>(() =>
    activeFilters.length > 0
      ? activeFilters.map((f) => ({ ...f, key: nextFilterRowKey++ }))
      : [{ key: nextFilterRowKey++, columnKey: columns[0]?.key ?? "", value: "" }],
  );
  const [showErrors, setShowErrors] = useState(false);

  function updateRow(key: number, patch: Partial<FilterRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function changeColumn(row: FilterRow, columnKey: string) {
    const listed = columns.find((c) => c.key === columnKey)?.options;
    // A typed value rarely fits a value list, start that row over.
    updateRow(row.key, { columnKey, value: listed && !listed.some((o) => o.value === row.value) ? "" : row.value });
  }

  function apply() {
    if (rows.some((r) => isRowInvalid(r, columns))) {
      setShowErrors(true);
      return;
    }
    onApply(rows.filter((r) => r.value.trim()).map(({ columnKey, value }) => ({ columnKey, value: value.trim() })));
    onClose();
  }

  function clear() {
    onApply([]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-neutral-800 p-5 shadow-2xl"
        style={{ background: "var(--gcs-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-black tracking-wide text-neutral-100 uppercase">{labels.title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200 active:scale-90">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-0.5">
          {rows.map((row) => {
            const column = columns.find((c) => c.key === row.columnKey);
            const invalid = showErrors && isRowInvalid(row, columns);
            return (
              <div key={row.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FilterDropdown
                    value={row.columnKey}
                    onChange={(columnKey) => changeColumn(row, columnKey)}
                    options={columns.map((c) => ({ value: c.key, label: c.label }))}
                    ariaLabel={labels.columnLabel}
                  />
                  {column?.options ? (
                    <FilterDropdown
                      value={row.value}
                      onChange={(value) => updateRow(row.key, { value })}
                      options={column.options}
                      ariaLabel={labels.valueLabel}
                      placeholder={labels.valuePlaceholder}
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode={column?.integer ? "numeric" : undefined}
                      value={row.value}
                      onChange={(e) => updateRow(row.key, { value: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && apply()}
                      placeholder={labels.valuePlaceholder}
                      aria-label={labels.valueLabel}
                      aria-invalid={invalid}
                      maxLength={COLUMN_FILTER_MAX_LENGTH}
                      className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[12px] text-neutral-200 focus:outline-none ${invalid ? "border-red-500/60" : "border-neutral-800 focus:border-[#e4ae22]/40"}`}
                      style={{ background: "var(--gcs-surface-2)" }}
                    />
                  )}
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      className="flex-none rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-red-400 active:scale-90"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </div>
                {invalid && labels.integerRequired && <p className="pl-1 text-[11px] text-red-400">{labels.integerRequired}</p>}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { key: nextFilterRowKey++, columnKey: columns[0]?.key ?? "", value: "" }])}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[11px] font-bold text-neutral-400 uppercase transition-colors hover:border-[#e4ae22]/40 hover:text-[#e4ae22] active:scale-[0.99]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {labels.addAnother}
        </button>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-neutral-800 px-3.5 py-2 text-[11px] font-bold text-neutral-400 uppercase transition-colors hover:bg-white/5 hover:text-neutral-100 active:scale-[0.97]"
          >
            {labels.clear}
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-[#e4ae22] px-3.5 py-2 text-[11px] font-black text-[#0b0b0c] uppercase transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"
          >
            {labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
}

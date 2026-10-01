/**
 * GC-Stats - stats-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StatRow } from "@/lib/stats-aggregate";
import {
  STAT_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  buildWeaponColumns,
  formatStatValue,
  clutchFraction,
  type StatColumn,
  type StatsMode,
} from "@/lib/stats-columns";
import { SegmentedTrack, SegmentedButton } from "@/components/stats/segmented";
import { AgentIcon } from "@/components/match/agent-icon";

/**
 * Sortable/filterable stats table with a persisted column picker and a
 * total/average toggle — same principle as V1's `statsTable()` Alpine
 * component (`stats-table-script.blade.php`), rebuilt as a React client
 * component so it can be shared between the player and team stats pages
 * (and later a tournament stats page) instead of writing this per page.
 */
export type StatsExtraColumn = {
  key: string;
  label: string;
  /** Precomputed cell content per row, keyed by `groupKey` — same reasoning as `identities` (built server-side, this is a Client Component). */
  cells: Record<string, React.ReactNode>;
  /** Plain-text value per row for the "Filter" modal (the cell itself may be a logo/icon, not plain text) — falls back to an empty string (never matches) if omitted. */
  searchValues?: Record<string, string>;
};

type StatsFilterRow = { key: number; columnKey: string; value: string };

let nextFilterRowKey = 0;

const STATS_PAGE_SIZE = 50;

function ColumnDropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (key: string) => void;
  options: { key: string; label: string }[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLabel = options.find((o) => o.key === value)?.label ?? "";

  // The trigger sits inside the filter modal's `overflow-y-auto` list — an
  // absolutely positioned menu would get clipped by that ancestor whenever
  // the row is near the bottom. Rendered through a portal at `fixed`
  // coordinates instead, tracked against the button, so it always draws on
  // top of the modal regardless of scroll position.
  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect)
        setMenuRect({
          top: rect.bottom + 6,
          left: rect.left,
          width: rect.width,
        });
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
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-800 px-3 py-2.5 text-left transition-colors hover:border-[#e4ae22]/30"
        style={{ background: "var(--gcs-surface-2)" }}
      >
        <span className="truncate text-[12px] font-bold text-neutral-200">
          {activeLabel}
        </span>
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
            style={{
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              background: "var(--gcs-surface-2)",
            }}
          >
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  onChange(o.key);
                  setOpen(false);
                }}
                role="option"
                aria-selected={value === o.key}
                className={`block w-full truncate px-3 py-2 text-left text-[12px] font-bold transition-colors hover:bg-[var(--gcs-hover)] ${value === o.key ? "text-[#e4ae22]" : "text-neutral-300"}`}
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

/**
 * "Filter" button + modal — one row per active filter (dropdown picking any
 * column, identity/extra columns included, + a free-text value), several
 * filters can be active at once. Purely client-side: every row is already
 * loaded in the browser for sorting/column-picking, so this never touches
 * SQL — the free-text value only ever runs through a local, case-insensitive
 * JS substring match, never a query, so there is no injection surface to
 * protect against here.
 */
function StatsFilterModal({
  onClose,
  columns,
  activeFilters,
  onApply,
  labels,
}: {
  onClose: () => void;
  columns: { key: string; label: string }[];
  activeFilters: StatsFilterRow[];
  onApply: (rows: StatsFilterRow[]) => void;
  labels: {
    title: string;
    columnLabel: string;
    valueLabel: string;
    valuePlaceholder: string;
    addAnother: string;
    apply: string;
    clear: string;
  };
}) {
  // Lazy initializer runs exactly once, at mount — the parent only mounts this
  // component while the modal is open (see `StatsTable`), so this naturally
  // resets whenever it's reopened, no effect needed to "sync" it to a prop.
  const [rows, setRows] = useState<StatsFilterRow[]>(() =>
    activeFilters.length > 0
      ? activeFilters.map((f) => ({ ...f, key: nextFilterRowKey++ }))
      : [
          {
            key: nextFilterRowKey++,
            columnKey: columns[0]?.key ?? "",
            value: "",
          },
        ],
  );

  function updateRow(key: number, patch: Partial<StatsFilterRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function apply() {
    onApply(rows.filter((r) => r.value.trim()));
    onClose();
  }

  function clear() {
    onApply([]);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-neutral-800 p-5 shadow-2xl"
        style={{ background: "var(--gcs-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-black tracking-wide text-neutral-100 uppercase">
            {labels.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-0.5">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <ColumnDropdown
                value={row.columnKey}
                onChange={(columnKey) => updateRow(row.key, { columnKey })}
                options={columns}
                ariaLabel={labels.columnLabel}
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) => updateRow(row.key, { value: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                placeholder={labels.valuePlaceholder}
                aria-label={labels.valueLabel}
                maxLength={100}
                className="flex-1 rounded-xl border border-neutral-800 px-3 py-2.5 text-[12px] text-neutral-200 focus:border-[#e4ae22]/40 focus:outline-none"
                style={{ background: "var(--gcs-surface-2)" }}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="flex-none rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-red-400"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                key: nextFilterRowKey++,
                columnKey: columns[0]?.key ?? "",
                value: "",
              },
            ])
          }
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-[11px] font-bold text-neutral-400 uppercase transition-colors hover:border-[#e4ae22]/40 hover:text-[#e4ae22]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {labels.addAnother}
        </button>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-neutral-800 px-3.5 py-2 text-[11px] font-bold text-neutral-400 uppercase transition-colors hover:bg-white/5 hover:text-neutral-100"
          >
            {labels.clear}
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-[#e4ae22] px-3.5 py-2 text-[11px] font-black text-[#0b0b0c] uppercase transition-transform hover:-translate-y-0.5"
          >
            {labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatsTable({
  rows,
  storageKey,
  columnLabels,
  weaponsGroupLabel,
  columnsButtonLabel,
  modeAvgLabel,
  modeTotalLabel,
  noDataLabel,
  identityColumnLabel,
  identities,
  extraColumns = [],
  filterLabels,
  paginationLabels,
}: {
  rows: StatRow[];
  storageKey: string;
  columnLabels: Record<string, string>;
  weaponsGroupLabel: string;
  columnsButtonLabel: string;
  modeAvgLabel: string;
  modeTotalLabel: string;
  noDataLabel: string;
  identityColumnLabel: string;
  /**
   * Precomputed identity cell content per row, keyed by `groupKey` — built
   * server-side (icon + label, e.g. a `Link` to the player page for team
   * stats) since this is a Client Component and render-prop functions can't
   * cross that boundary as props.
   */
  identities: Record<
    string,
    {
      icon?: React.ReactNode;
      initial?: string;
      agentIcon?: string;
      label: React.ReactNode;
      searchValue?: string;
    }
  >;
  /** Extra fixed (non-sortable) columns rendered right after identity, before the sortable stat columns — e.g. the tournament stats page's Agent/Nationality/Team columns (V1 parity). Unused by team/player stats pages. */
  extraColumns?: StatsExtraColumn[];
  /** Labels for the "Filter" button + modal (any column, including identity/extra ones, by a free-text value — purely client-side, see `StatsFilterModal`). */
  filterLabels: {
    button: string;
    title: string;
    columnLabel: string;
    valueLabel: string;
    valuePlaceholder: string;
    addAnother: string;
    apply: string;
    clear: string;
  };
  /** Pager labels, same shape as `ListPagination` — `pageOf` keeps its `{page}`/`{total}` placeholders, filled in client-side since pagination here is a local page index, not a server route. */
  paginationLabels: { previous: string; next: string; pageOf: string };
}) {
  const weaponColumns = useMemo(() => buildWeaponColumns(rows), [rows]);
  const allColumns = useMemo(
    () => [...STAT_COLUMNS, ...weaponColumns],
    [weaponColumns],
  );

  const storageName = `gcs.stats.cols.${storageKey}`;
  const [visibleCols, setVisibleCols] = useState<string[]>(
    DEFAULT_VISIBLE_COLUMNS,
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [mode, setMode] = useState<StatsMode>("avg");
  const [sortCol, setSortCol] = useState("acs");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<StatsFilterRow[]>([]);
  const [page, setPage] = useState(1);

  const IDENTITY_FILTER_KEY = "__identity__";
  const filterableColumns = useMemo(
    () => [
      { key: IDENTITY_FILTER_KEY, label: identityColumnLabel },
      ...extraColumns.map((c) => ({ key: c.key, label: c.label })),
      ...STAT_COLUMNS.map((c) => ({
        key: c.key,
        label: columnLabels[c.key] ?? c.key,
      })),
    ],
    [identityColumnLabel, extraColumns, columnLabels],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageName);
      if (stored) setVisibleCols(JSON.parse(stored));
    } catch {
      // corrupted/blocked storage — keep defaults
    }
  }, [storageName]);

  function toggleCol(key: string) {
    setVisibleCols((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      try {
        localStorage.setItem(storageName, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function sortBy(key: string) {
    if (sortCol === key) {
      setSortAsc((a) => !a);
    } else {
      setSortCol(key);
      setSortAsc(false);
    }
  }

  const sorted = useMemo(() => {
    const col = allColumns.find((c) => c.key === sortCol);
    if (!col) return rows;
    const withValue = rows.map((r) => ({ row: r, value: col.value(r, mode) }));
    withValue.sort((a, b) => (sortAsc ? a.value - b.value : b.value - a.value));
    return withValue.map((w) => w.row);
  }, [rows, allColumns, sortCol, sortAsc, mode]);

  const shownColumns = allColumns.filter((c) => visibleCols.includes(c.key));
  const visibleWeaponCount = weaponColumns.filter((c) =>
    visibleCols.includes(c.key),
  ).length;

  function cellSearchValue(row: StatRow, columnKey: string): string {
    if (columnKey === IDENTITY_FILTER_KEY)
      return identities[row.groupKey]?.searchValue ?? row.groupKey;
    const extra = extraColumns.find((c) => c.key === columnKey);
    if (extra) return extra.searchValues?.[row.groupKey] ?? "";
    const col = STAT_COLUMNS.find((c) => c.key === columnKey);
    return col ? formatStatValue(col.value(row, mode), col.format) : "";
  }

  const filtered = useMemo(() => {
    if (activeFilters.length === 0) return sorted;
    return sorted.filter((row) =>
      activeFilters.every((f) =>
        cellSearchValue(row, f.columnKey)
          .toLowerCase()
          .includes(f.value.trim().toLowerCase()),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, activeFilters, mode]);

  // Any change upstream of pagination (new data from the server, a re-sort, a new filter) can shrink the result set below the current page — always land back on page 1 rather than showing an empty page.
  useEffect(() => {
    setPage(1);
  }, [rows, sortCol, sortAsc, activeFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / STATS_PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * STATS_PAGE_SIZE, page * STATS_PAGE_SIZE),
    [filtered, page],
  );
  const [scrolledX, setScrolledX] = useState(false);

  return (
    <div className="rounded-xl border border-neutral-800 bg-[var(--gcs-surface)] shadow-xl">
      <div className="relative">
        <div className="flex items-center justify-between border-b border-neutral-800/70 p-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setColPickerOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-3 py-1.5 text-[10px] font-black tracking-wider text-neutral-400 uppercase transition-colors hover:bg-white/[0.06] hover:text-neutral-50"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
              </svg>
              {columnsButtonLabel}
            </button>

            <button
              type="button"
              onClick={() => setFilterModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-black tracking-wider uppercase transition-colors"
              style={
                activeFilters.length > 0
                  ? { background: "rgba(228,174,34,0.12)", color: "#e4ae22" }
                  : undefined
              }
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M4 6h16M7 12h10M11 18h2" />
              </svg>
              {filterLabels.button}
              {activeFilters.length > 0 && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-black"
                  style={{ background: "#e4ae22", color: "#0b0b0c" }}
                >
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>

          <SegmentedTrack>
            <SegmentedButton
              onClick={() => setMode("avg")}
              active={mode === "avg"}
            >
              {modeAvgLabel}
            </SegmentedButton>
            <SegmentedButton
              onClick={() => setMode("total")}
              active={mode === "total"}
            >
              {modeTotalLabel}
            </SegmentedButton>
          </SegmentedTrack>
        </div>

        {filterModalOpen && (
          <StatsFilterModal
            onClose={() => setFilterModalOpen(false)}
            columns={filterableColumns}
            activeFilters={activeFilters}
            onApply={setActiveFilters}
            labels={filterLabels}
          />
        )}

        {colPickerOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setColPickerOpen(false)}
            />
            <div className="absolute top-11 left-2 z-50 w-56 space-y-0.5 rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] p-2 shadow-2xl">
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                {STAT_COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] text-neutral-300 hover:bg-white/[0.04]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(c.key)}
                      onChange={() => toggleCol(c.key)}
                      className="h-3.5 w-3.5 rounded border-neutral-700 bg-black/40 text-[#e4ae22] focus:ring-0"
                    />
                    {columnLabels[c.key] ?? c.key}
                  </label>
                ))}
              </div>

              {weaponColumns.length > 0 && (
                <div className="group/weapon relative mt-1 border-t border-neutral-800 pt-1">
                  <div className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-[11px] text-neutral-300">
                    <span className="flex items-center gap-2">
                      {weaponsGroupLabel}
                      <span className="text-neutral-600">
                        ({visibleWeaponCount})
                      </span>
                    </span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="flex-none text-neutral-600"
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="absolute top-0 left-full z-50 hidden max-h-72 w-44 space-y-0.5 overflow-y-auto rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] p-1 shadow-2xl group-hover/weapon:block">
                    {weaponColumns.map((c) => (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] text-neutral-300 hover:bg-white/[0.06]"
                      >
                        <input
                          type="checkbox"
                          checked={visibleCols.includes(c.key)}
                          onChange={() => toggleCol(c.key)}
                          className="h-3.5 w-3.5 rounded border-neutral-700 bg-black/40 text-[#e4ae22] focus:ring-0"
                        />
                        {columnLabels[c.key] ?? c.key}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div
        className="group/scroll overflow-x-auto"
        data-scrolled={scrolledX}
        onScroll={(e) => setScrolledX(e.currentTarget.scrollLeft > 0)}
      >
        <table className="w-full min-w-[650px] border-separate border-spacing-0 text-[11px]">
          <thead className="bg-black/20 font-black text-neutral-500 uppercase">
            <tr>
              <th
                scope="col"
                className={`${STICKY_CELL} border-b border-neutral-800/70 bg-[color-mix(in_srgb,var(--gcs-surface)_80%,black)] p-3 text-left`}
              >
                {identityColumnLabel}
              </th>
              {extraColumns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="border-b border-neutral-800/70 p-3 text-center"
                >
                  {c.label}
                </th>
              ))}
              {shownColumns.map((c) => (
                <StatsHeaderCell
                  key={c.key}
                  col={c}
                  label={columnLabels[c.key] ?? c.key}
                  active={sortCol === c.key}
                  sortAsc={sortAsc}
                  onClick={() => sortBy(c.key)}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {paginated.map((row) => (
              <StatsBodyRow
                key={row.groupKey}
                row={row}
                columns={shownColumns}
                mode={mode}
                identity={identities[row.groupKey]}
                extraColumns={extraColumns}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Outside the scroller, so it centers on the visible width */}
      {filtered.length === 0 && (
        <p className="p-8 text-center text-[11px] font-black tracking-widest text-neutral-600 uppercase">
          {noDataLabel}
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-neutral-800/70 p-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-[var(--gcs-hover)] disabled:pointer-events-none disabled:opacity-40"
          >
            {paginationLabels.previous}
          </button>
          <span className="text-xs text-[var(--gcs-text-tertiary)]">
            {paginationLabels.pageOf
              .replace("{page}", String(page))
              .replace("{total}", String(totalPages))}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface-2)] px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-[var(--gcs-hover)] disabled:pointer-events-none disabled:opacity-40"
          >
            {paginationLabels.next}
          </button>
        </div>
      )}
    </div>
  );
}

// Identity column stays put on horizontal scroll, with a shadow once content slides under it.
const STICKY_CELL =
  "sticky left-0 z-[1] group-data-[scrolled=true]/scroll:shadow-[6px_0_8px_-6px_rgba(0,0,0,0.7)]";

function StatsHeaderCell({
  col,
  label,
  active,
  sortAsc,
  onClick,
}: {
  col: StatColumn;
  label: string;
  active: boolean;
  sortAsc: boolean;
  onClick: () => void;
}) {
  return (
    <th
      scope="col"
      onClick={onClick}
      className="cursor-pointer border-b border-neutral-800/70 p-3 text-center transition-colors hover:text-neutral-50"
    >
      <span className="flex items-center justify-center gap-1">
        {label}
        <span className="flex flex-col opacity-40">
          <svg
            width="7"
            height="7"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: active && sortAsc ? "#e4ae22" : undefined }}
          >
            <path d="M12 3l8 8H4z" />
          </svg>
          <svg
            width="7"
            height="7"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: active && !sortAsc ? "#e4ae22" : undefined }}
          >
            <path d="M12 21l-8-8h16z" />
          </svg>
        </span>
      </span>
    </th>
  );
}

function StatsBodyRow({
  row,
  columns,
  mode,
  identity,
  extraColumns,
}: {
  row: StatRow;
  columns: StatColumn[];
  mode: StatsMode;
  identity?: {
    icon?: React.ReactNode;
    initial?: string;
    agentIcon?: string;
    label: React.ReactNode;
  };
  extraColumns: StatsExtraColumn[];
}) {
  return (
    <tr className="group/row transition-colors hover:bg-white/[0.03]">
      <td
        className={`${STICKY_CELL} max-w-[160px] border-b border-neutral-800/40 bg-[var(--gcs-surface)] p-2.5 transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--gcs-surface)_97%,white)] sm:max-w-none`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {identity?.icon ??
            (identity?.agentIcon ? (
              <AgentIcon agent={identity.agentIcon} size="h-7 w-7" />
            ) : (
              identity?.initial && (
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white/[0.06] text-[11px] font-black text-neutral-400">
                  {identity.initial}
                </span>
              )
            ))}
          <span className="truncate font-semibold text-neutral-100">
            {identity?.label ?? row.groupKey}
          </span>
        </span>
      </td>
      {extraColumns.map((c) => (
        <td
          key={c.key}
          className="border-b border-neutral-800/40 p-2.5 text-center text-neutral-300"
        >
          {c.cells[row.groupKey]}
        </td>
      ))}
      {columns.map((c) => (
        <td
          key={c.key}
          className="border-b border-neutral-800/40 p-2.5 text-center text-neutral-300"
        >
          {c.key === "clutches"
            ? `${clutchFraction(row).won}/${clutchFraction(row).played}`
            : formatStatValue(c.value(row, mode), c.format)}
        </td>
      ))}
    </tr>
  );
}

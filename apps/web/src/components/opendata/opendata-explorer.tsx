/**
 * GC-Stats - opendata-explorer
 *
 * Table of one OpenData dataset. Sorting, search, column filters and pagination run on the
 * server through the public API (same rate limit and cache as any client);
 * TanStack Table handles the headless table state (sort, column visibility).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, RotateCw, Search, X } from "lucide-react";
import { ColumnFilterButton, ColumnFilterModal, type ColumnFilter, type ColumnFilterColumn } from "@/components/filters/column-filter-modal";
import { PublicSelect } from "@/components/forms/public-select";
import { OpenDataCell } from "@/components/opendata/opendata-cell";
import { OpenDataColumnPicker } from "@/components/opendata/opendata-column-picker";
import { OpenDataDownloadButton } from "@/components/opendata/opendata-download-button";
import {
  OPENDATA_DATASET_META,
  OPENDATA_FILTER_PREFIX,
  OPENDATA_LIST_VALUES,
  OPENDATA_MAX_FILTERS,
  OPENDATA_MAX_QUERY_LENGTH,
  OPENDATA_PAGE_SIZES,
  type OpenDataDataset,
  type OpenDataErrorCode,
  type OpenDataPageResponse,
  type OpenDataRow,
  isIntegerColumnType,
} from "@/lib/opendata/datasets-meta";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 400;
const SKELETON_ROWS = 10;

type ExplorerError = { code: OpenDataErrorCode | "network"; retryAfter: number | null };

export type OpenDataExplorerInitialState = { sort: string; direction: "asc" | "desc"; page: number; perPage: number; q: string; filters: ColumnFilter[] };

function visibilityStorageKey(dataset: OpenDataDataset): string {
  return `gcs-opendata-columns:${dataset}`;
}

function defaultVisibility(dataset: OpenDataDataset): VisibilityState {
  return Object.fromEntries(OPENDATA_DATASET_META[dataset].columns.map((c) => [c.key, c.defaultVisible]));
}

export function OpenDataExplorer({ dataset, initial }: { dataset: OpenDataDataset; initial: OpenDataExplorerInitialState }) {
  const t = useTranslations("openData");
  const locale = useLocale();
  const meta = OPENDATA_DATASET_META[dataset];

  const [sorting, setSorting] = useState<SortingState>([{ id: initial.sort, desc: initial.direction === "desc" }]);
  const [page, setPage] = useState(initial.page);
  const [perPage, setPerPage] = useState(initial.perPage);
  const [search, setSearch] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [filters, setFilters] = useState<ColumnFilter[]>(initial.filters);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => defaultVisibility(dataset));
  const [response, setResponse] = useState<OpenDataPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ExplorerError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const sort = sorting[0]?.id ?? meta.defaultSort;
  const direction = sorting[0]?.desc ? "desc" : "asc";

  useEffect(() => {
    try {
      const stored = localStorage.getItem(visibilityStorageKey(dataset));
      if (stored) setColumnVisibility({ ...defaultVisibility(dataset), ...(JSON.parse(stored) as VisibilityState) });
    } catch {
      // Storage unavailable: defaults stay.
    }
  }, [dataset]);

  const updateVisibility = useCallback(
    (next: VisibilityState) => {
      setColumnVisibility(next);
      try {
        localStorage.setItem(visibilityStorageKey(dataset), JSON.stringify(next));
      } catch {
        // Storage unavailable: the choice lasts for this visit only.
      }
    },
    [dataset],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim().slice(0, OPENDATA_MAX_QUERY_LENGTH);
      if (next !== q) {
        setQ(next);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, q]);

  // Search and column filters, shared by the table query and the export.
  const selection = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const f of filters) params.append(`${OPENDATA_FILTER_PREFIX}${f.columnKey}`, f.value);
    return params.toString();
  }, [q, filters]);

  useEffect(() => {
    const params = new URLSearchParams(selection);
    for (const [key, value] of Object.entries({ page: String(page), per_page: String(perPage), sort, direction })) params.set(key, value);

    // Shareable URL without a navigation.
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    fetch(`/api/opendata/${dataset}?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: OpenDataErrorCode };
          const retryAfter = Number(res.headers.get("Retry-After"));
          setError({ code: body.error ?? "internal_error", retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null });
          return;
        }
        const body = (await res.json()) as OpenDataPageResponse;
        setResponse(body);
        if (body.page > body.total_pages) setPage(body.total_pages);
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setError({ code: "network", retryAfter: null });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [dataset, page, perPage, sort, direction, selection, reloadKey]);

  useEffect(() => {
    if (!error?.retryAfter) return;
    setCountdown(error.retryAfter);
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [error]);

  const columns = useMemo<ColumnDef<OpenDataRow>[]>(
    () =>
      meta.columns.map((column) => ({
        id: column.key,
        accessorFn: (row) => row[column.key],
        header: t(`columns.${column.key}` as never),
        cell: ({ row }) => <OpenDataCell column={column} row={row.original} />,
      })),
    [meta, t],
  );

  const filterColumns = useMemo<ColumnFilterColumn[]>(
    () =>
      meta.columns.map((column) => {
        const listed = OPENDATA_LIST_VALUES[column.type];
        const valueLabel = (value: string) => (column.type === "boolean" ? t(value === "true" ? "yes" : "no") : t(`status.${value}` as never));
        return {
          key: column.key,
          label: t(`columns.${column.key}` as never),
          options: listed?.map((value) => ({ value, label: valueLabel(value) })),
          integer: isIntegerColumnType(column.type),
        };
      }),
    [meta, t],
  );

  const table = useReactTable({
    data: response?.data ?? [],
    columns,
    state: { sorting, columnVisibility },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    sortDescFirst: false,
    pageCount: response?.total_pages ?? -1,
    onSortingChange: (updater) => {
      setSorting((prev) => (typeof updater === "function" ? updater(prev) : updater));
      setPage(1);
    },
    onColumnVisibilityChange: (updater) => updateVisibility(typeof updater === "function" ? updater(columnVisibility) : updater),
  });

  const total = response?.total ?? 0;
  const totalPages = response?.total_pages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const visibleColumns = table.getVisibleLeafColumns();
  const showSkeleton = loading && !response;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="search"
            value={search}
            maxLength={OPENDATA_MAX_QUERY_LENGTH}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(`searchPlaceholder.${dataset}`)}
            aria-label={t("searchLabel")}
            className="w-full rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] py-2 pr-9 pl-9 text-[13.5px] text-neutral-50 outline-none transition-colors placeholder:text-neutral-500 focus:border-[#e4ae22]/60 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("clearSearch")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200 active:scale-90"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ColumnFilterButton label={t("filters.button")} activeCount={filters.length} onClick={() => setFilterModalOpen(true)} />
          <PublicSelect
            value={String(perPage)}
            onChange={(v) => {
              setPerPage(Number(v));
              setPage(1);
            }}
            options={OPENDATA_PAGE_SIZES.map((size) => ({ value: String(size), label: t("perPage", { count: size }) }))}
          />
          <OpenDataColumnPicker
            label={t("columnsPicker")}
            showAllLabel={t("showAllColumns")}
            resetLabel={t("resetColumns")}
            columns={meta.columns.map((c) => ({ key: c.key, label: t(`columns.${c.key}` as never) }))}
            isVisible={(key) => columnVisibility[key] !== false}
            onToggle={(key) => updateVisibility({ ...columnVisibility, [key]: columnVisibility[key] === false })}
            onShowAll={() => updateVisibility(Object.fromEntries(meta.columns.map((c) => [c.key, true])))}
            onReset={() => updateVisibility(defaultVisibility(dataset))}
          />
          <OpenDataDownloadButton dataset={dataset} variant="secondary" selection={selection} />
        </div>
      </div>

      {filterModalOpen && (
        <ColumnFilterModal
          onClose={() => setFilterModalOpen(false)}
          columns={filterColumns}
          activeFilters={filters}
          onApply={(next) => {
            setFilters(next.slice(0, OPENDATA_MAX_FILTERS));
            setPage(1);
          }}
          labels={{
            button: t("filters.button"),
            title: t("filters.title"),
            columnLabel: t("filters.column"),
            valueLabel: t("filters.value"),
            valuePlaceholder: t("filters.valuePlaceholder"),
            addAnother: t("filters.addAnother"),
            apply: t("filters.apply"),
            clear: t("filters.clear"),
            integerRequired: t("filters.integerRequired"),
          }}
        />
      )}

      <div className="flex items-center justify-between gap-3 text-[12.5px] text-[var(--gcs-text-tertiary)]">
        <span aria-live="polite">
          {response ? t("rowsRange", { from: from.toLocaleString(locale), to: to.toLocaleString(locale), total: total.toLocaleString(locale) }) : t("loading")}
        </span>
        {loading && response && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" />
            {t("loading")}
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13.5px] text-neutral-200">
          <span>
            {t(`errors.${error.code}`)}
            {countdown > 0 && <span className="ml-1 text-neutral-400">{t("retryIn", { seconds: countdown })}</span>}
          </span>
          {error.code !== "account_required" && error.code !== "disabled" && (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={countdown > 0 || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-[var(--gcs-hover)] active:scale-[0.97] disabled:opacity-40"
            >
              <RotateCw className={cn("size-3.5", loading && "animate-spin")} />
              {t("retry")}
            </button>
          )}
        </div>
      )}

      <div className="relative overflow-x-auto rounded-xl border border-neutral-800 bg-[var(--gcs-surface)]">
        <table className={cn("w-full border-collapse text-left text-[13px] transition-opacity", loading && response && "opacity-50")}>
          <thead className="sticky top-0 z-10 bg-[var(--gcs-surface-2)]">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header, index) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      className={cn("border-b border-neutral-800 px-3 py-0 font-semibold whitespace-nowrap", index === 0 && "sticky left-0 z-10 bg-[var(--gcs-surface-2)]")}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "-mx-1.5 my-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] tracking-wide uppercase transition-colors hover:bg-white/5 hover:text-neutral-50 active:bg-white/10",
                          sorted ? "text-[#e4ae22]" : "text-neutral-400",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? <ArrowUp className="size-3.5" /> : sorted === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} className="border-b border-neutral-800/60">
                  {visibleColumns.map((c) => (
                    <td key={c.id} className="px-3 py-2.5">
                      <span className="block h-3.5 w-full max-w-[120px] animate-pulse rounded bg-white/5" />
                    </td>
                  ))}
                </tr>
              ))}
            {!showSkeleton && table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-3 py-12 text-center text-neutral-500">
                  {filters.length > 0 ? t("noResultsFiltered") : q ? t("noResultsFor", { q }) : t("noResults")}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="group border-b border-neutral-800/60 transition-colors last:border-0 hover:bg-white/[0.03]">
                {row.getVisibleCells().map((cell, index) => (
                  <td
                    key={cell.id}
                    className={cn("px-3 py-2 whitespace-nowrap text-neutral-300", index === 0 && "sticky left-0 bg-[var(--gcs-surface)] group-hover:bg-[var(--gcs-surface-2)]")}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1.5" aria-label={t("pagination")}>
          {[
            { icon: ChevronsLeft, label: t("firstPage"), target: 1, disabled: page <= 1 },
            { icon: ChevronLeft, label: t("previousPage"), target: page - 1, disabled: page <= 1 },
          ].map(({ icon: Icon, label, target, disabled }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              disabled={disabled || loading}
              onClick={() => setPage(target)}
              className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface)] p-1.5 text-neutral-300 transition-all hover:bg-[var(--gcs-hover)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              <Icon className="size-4" />
            </button>
          ))}
          <span className="px-2 text-xs text-[var(--gcs-text-tertiary)] tabular-nums">{t("pageOf", { page, total: totalPages })}</span>
          {[
            { icon: ChevronRight, label: t("nextPage"), target: page + 1, disabled: page >= totalPages },
            { icon: ChevronsRight, label: t("lastPage"), target: totalPages, disabled: page >= totalPages },
          ].map(({ icon: Icon, label, target, disabled }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              disabled={disabled || loading}
              onClick={() => setPage(target)}
              className="rounded-lg border border-neutral-800 bg-[var(--gcs-surface)] p-1.5 text-neutral-300 transition-all hover:bg-[var(--gcs-hover)] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              <Icon className="size-4" />
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

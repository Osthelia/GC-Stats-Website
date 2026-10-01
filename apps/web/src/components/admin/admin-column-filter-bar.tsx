/**
 * GC-Stats - admin-column-filter-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FilterIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type AdminFilterColumn = { value: string; label: string };
export type AdminActiveFilter = { field: string; value: string };

type FilterRow = { key: number; field: string; value: string };

let nextRowKey = 0;

type AdminColumnFilterBarProps = { columns: AdminFilterColumn[]; activeFilters: AdminActiveFilter[] } & (
  | { onApply: (filters: AdminActiveFilter[]) => void; pathname?: undefined; baseQuery?: undefined }
  | { pathname: string; baseQuery: Record<string, string>; onApply?: undefined }
);

/**
 * "Filtrer" button + dialog — one row per active filter (any column, a
 * free-text value), several filters active at once, AND'ed together.
 * Two modes: pass `onApply` for a client-loaded panel with the full
 * dataset already in the browser (just sets local state, e.g.
 * TournamentEntrantsPanel); pass `pathname`/`baseQuery` for a
 * server-paginated list, which pushes `f_<field>=value` query params
 * instead (see admin/tournaments/page.tsx) so filtering applies across
 * every page of results, not just the ones currently on screen.
 */
export function AdminColumnFilterBar({ columns, activeFilters, ...mode }: AdminColumnFilterBarProps) {
  const t = useTranslations("admin.filters");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FilterRow[]>([]);

  function openDialog() {
    setRows(activeFilters.length > 0 ? activeFilters.map((f) => ({ ...f, key: nextRowKey++ })) : [{ key: nextRowKey++, field: columns[0]?.value ?? "", value: "" }]);
    setOpen(true);
  }

  function updateRow(key: number, patch: Partial<FilterRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function submit(filters: AdminActiveFilter[]) {
    if (mode.onApply) {
      mode.onApply(filters);
      return;
    }
    const query: Record<string, string> = { ...mode.baseQuery };
    for (const f of filters) query[`f_${f.field}`] = f.value;
    router.push({ pathname: mode.pathname, query });
  }

  function apply() {
    submit(rows.filter((r) => r.value.trim()).map((r) => ({ field: r.field, value: r.value.trim() })));
    setOpen(false);
  }

  function clear() {
    submit([]);
    setOpen(false);
  }

  const columnItems = Object.fromEntries(columns.map((c) => [c.value, c.label]));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openDialog}
        className={activeFilters.length > 0 ? "border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/15 hover:text-amber-400" : undefined}
      >
        <FilterIcon className="size-3.5" />
        {t("button")}
        {activeFilters.length > 0 && <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-black">{activeFilters.length}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto py-1">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <Select items={columnItems} value={row.field} onValueChange={(v) => v && updateRow(row.key, { field: v })}>
                  <SelectTrigger aria-label={t("columnLabel")} className="w-36 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={row.value}
                  onChange={(e) => updateRow(row.key, { value: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && apply()}
                  placeholder={t("valuePlaceholder")}
                  aria-label={t("valueLabel")}
                  className="flex-1"
                />
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}>
                    <XIcon className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={() => setRows((prev) => [...prev, { key: nextRowKey++, field: columns[0]?.value ?? "", value: "" }])}
          >
            <PlusIcon className="size-3.5" />
            {t("addAnother")}
          </Button>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={clear}>
              {t("clear")}
            </Button>
            <Button type="button" onClick={apply}>
              {t("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * GC-Stats - admin-search-sort-bar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AdminListOption = { value: string; label: string };
/** Additional filter select, stored in the query string under `key`. */
export type AdminListFilter = { key: string; value: string; label: string; options: AdminListOption[] };

/** "" (no filter) can't be a Select item value (base-ui disallows empty strings) — options use "any" instead, mapped to/from the query string here. */
const ANY = "any";

function FilterSelect({ value, options, onChange, ariaLabel }: { value: string; options: AdminListOption[]; onChange: (value: string) => void; ariaLabel: string }) {
  const items = Object.fromEntries(options.map((o) => [o.value || ANY, o.label]));
  return (
    <Select items={items} value={value || ANY} onValueChange={(v) => onChange(v && v !== ANY ? v : "")}>
      <SelectTrigger aria-label={ariaLabel} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value || ANY}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Search input + filter selects for an admin list page. Column sort itself
 * lives in the table's own clickable headers (AdminSortableTh) — mirrors
 * V1's tournament stats tables — this bar only carries search + the
 * non-column filters (recency window, status).
 */
export function AdminSearchSortBar({
  searchPlaceholder,
  searchSubmitLabel,
  searchValue,
  sort,
  direction,
  activeWithinValue,
  activeWithinOptions,
  activeWithinLabel,
  statusValue,
  statusOptions,
  statusLabel,
  extraFilters = [],
}: {
  searchPlaceholder: string;
  searchSubmitLabel: string;
  searchValue: string;
  sort: string;
  direction: string;
  activeWithinValue: string;
  activeWithinOptions: AdminListOption[];
  activeWithinLabel: string;
  statusValue: string;
  statusOptions: AdminListOption[];
  statusLabel: string;
  extraFilters?: AdminListFilter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(searchValue);

  function pushQuery(next: Record<string, string>) {
    const extra = Object.fromEntries(extraFilters.map((f) => [f.key, f.value]));
    const merged = { q, sort, direction, activeWithin: activeWithinValue, status: statusValue, ...extra, ...next };
    const query = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== ""));
    router.push({ pathname, query });
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        pushQuery({ q });
      }}
    >
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="w-64" />
      <Button type="submit" variant="outline" size="sm">
        {searchSubmitLabel}
      </Button>
      {activeWithinOptions.length > 0 && <FilterSelect value={activeWithinValue} options={activeWithinOptions} onChange={(v) => pushQuery({ activeWithin: v })} ariaLabel={activeWithinLabel} />}
      {statusOptions.length > 0 && <FilterSelect value={statusValue} options={statusOptions} onChange={(v) => pushQuery({ status: v })} ariaLabel={statusLabel} />}
      {extraFilters.map((f) => (
        <FilterSelect key={f.key} value={f.value} options={f.options} onChange={(v) => pushQuery({ [f.key]: v })} ariaLabel={f.label} />
      ))}
    </form>
  );
}

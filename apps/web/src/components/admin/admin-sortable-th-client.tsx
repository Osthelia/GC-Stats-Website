/**
 * GC-Stats - admin-sortable-th-client
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Client-side sortable `<th>` — for tables whose full dataset is already
 * loaded in the browser (a tournament's own entrants/matches, not the
 * server-paginated global lists), so sorting is just local state instead of
 * a URL round-trip. Same visuals as the server-driven `AdminSortableTh`.
 */
export function AdminSortableThClient<Col extends string>({
  col,
  label,
  sort,
  direction,
  onSort,
  className,
}: {
  col: Col;
  label: string;
  sort: Col;
  direction: "asc" | "desc";
  onSort: (col: Col) => void;
  className?: string;
}) {
  const active = sort === col;
  return (
    <TableHead className={className}>
      <button type="button" onClick={() => onSort(col)} className="group inline-flex items-center gap-1 text-foreground select-none hover:text-primary">
        {label}
        <span className="flex flex-col -space-y-0.5">
          <ChevronUp className={cn("size-2.5 opacity-30 group-hover:opacity-70", active && direction === "asc" && "text-primary opacity-100")} />
          <ChevronDown className={cn("size-2.5 opacity-30 group-hover:opacity-70", active && direction === "desc" && "text-primary opacity-100")} />
        </span>
      </button>
    </TableHead>
  );
}

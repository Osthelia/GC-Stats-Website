/**
 * GC-Stats - admin-sortable-th
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ChevronUp, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Server-rendered sortable `<th>` — clicking re-requests the page with
 * `sort`/`direction` set, so the whole result set re-sorts (not just the
 * rows on screen), same approach as V1's `<x-admin.sortable-th>`.
 */
export function AdminSortableTh({
  pathname,
  col,
  label,
  currentSort,
  currentDirection,
  query,
  className,
}: {
  pathname: string;
  col: string;
  label: string;
  currentSort: string;
  currentDirection: "asc" | "desc";
  query: Record<string, string>;
  className?: string;
}) {
  const isActive = currentSort === col;
  const nextDirection = isActive && currentDirection === "asc" ? "desc" : "asc";
  const cleanQuery = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""));

  return (
    <TableHead className={className}>
      <Link
        href={{ pathname, query: { ...cleanQuery, sort: col, direction: nextDirection } }}
        className="group inline-flex items-center gap-1 text-foreground select-none hover:text-primary"
      >
        {label}
        <span className="flex flex-col -space-y-0.5">
          <ChevronUp className={cn("size-2.5 opacity-30 group-hover:opacity-70", isActive && currentDirection === "asc" && "text-primary opacity-100")} />
          <ChevronDown className={cn("size-2.5 opacity-30 group-hover:opacity-70", isActive && currentDirection === "desc" && "text-primary opacity-100")} />
        </span>
      </Link>
    </TableHead>
  );
}

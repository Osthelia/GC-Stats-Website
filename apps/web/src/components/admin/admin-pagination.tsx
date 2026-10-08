/**
 * GC-Stats - admin-pagination
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Server-rendered prev/next pagination — for lists too large to load in one page (e.g. /admin/emotes, ~4k rows). Preserves the current search/sort/filter query string. */
export function AdminPagination({
  pathname,
  page,
  totalPages,
  total,
  query,
  label,
  className,
  pageParam = "page",
}: {
  pathname: string;
  page: number;
  totalPages: number;
  total: number;
  query: Record<string, string>;
  label: string;
  className?: string;
  /** Query key holding the page number, for screens with several paginated blocks. */
  pageParam?: string;
}) {
  if (totalPages <= 1) return null;

  const cleanQuery = Object.fromEntries(Object.entries(query).filter(([k, v]) => v !== "" && k !== pageParam));

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" render={<Link href={{ pathname, query: { ...cleanQuery, [pageParam]: String(page - 1) } }} />}>
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" render={<Link href={{ pathname, query: { ...cleanQuery, [pageParam]: String(page + 1) } }} />}>
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

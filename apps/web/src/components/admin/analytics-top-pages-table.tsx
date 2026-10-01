/**
 * GC-Stats - analytics-top-pages-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import type { TopPageRow, TopPageSort, SortDirection } from "@/lib/admin-analytics";

/** Server-rendered top-pages table for /admin/analytics — sortable/searchable/paginated per CLAUDE.md's admin list convention. */
export function AnalyticsTopPagesTable({
  rows,
  sortable,
  pagination,
}: {
  rows: TopPageRow[];
  sortable: { pathname: string; sort: TopPageSort; direction: SortDirection; query: Record<string, string> };
  pagination: { page: number; totalPages: number; total: number };
}) {
  const t = useTranslations("admin.analytics");

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname={sortable.pathname} col="page" label={t("columnPage")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh
                pathname={sortable.pathname}
                col="views"
                label={t("columnViews")}
                currentSort={sortable.sort}
                currentDirection={sortable.direction}
                query={sortable.query}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.uri}>
                <TableCell className="font-mono text-xs">{row.uri}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{row.views.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination pathname={sortable.pathname} page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} query={sortable.query} label={`${pagination.total}`} />
    </div>
  );
}

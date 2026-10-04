/**
 * GC-Stats - change-requests-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { ChangeRequestStatusBadge } from "@/components/admin/change-request-status-badge";
import type { AdminChangeRequestRow, SortDirection } from "@/lib/admin-change-requests";
import { FormattedDate } from "@/components/formatted-date";

/** Server component — the list itself is read-only (approving/rejecting happens on the detail page), so no client state needed here. */
export function ChangeRequestsPanel({
  rows,
  sortable,
}: {
  rows: AdminChangeRequestRow[];
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.changeRequests");

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columnSubject")}</TableHead>
            <TableHead>{t("columnRequester")}</TableHead>
            <TableHead>{t("columnItems")}</TableHead>
            <AdminSortableTh pathname={sortable.pathname} col="status" label={t("columnStatus")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <AdminSortableTh pathname={sortable.pathname} col="createdAt" label={t("columnCreatedAt")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{row.subjectLabel ?? t("unknownSubject", { id: row.subjectId })}</span>
                  <span className="text-xs text-muted-foreground">{row.subjectType === "team" ? t("subjectTeam") : t("subjectPerson")}</span>
                </div>
              </TableCell>
              <TableCell>{row.requestedByUsername ?? t("detail.requestedByUnknown")}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {t("itemsSummary", { approved: row.approvedItems, rejected: row.rejectedItems, pending: row.pendingItems })}
              </TableCell>
              <TableCell>
                <ChangeRequestStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground"><FormattedDate date={row.createdAt} /></TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" render={<Link href={`/admin/change-requests/${row.id}`} />}>
                  {t("viewButton")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * GC-Stats - reports-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { ReportStatusBadge } from "@/components/admin/report-status-badge";
import { ReportReviewDialog } from "@/components/admin/report-review-dialog";
import { reopenReport } from "@/actions/admin-reports";
import { cn } from "@/lib/utils";
import type { AdminReportRow, SortDirection } from "@/lib/admin-reports";

function ReportTarget({ row }: { row: AdminReportRow }) {
  const t = useTranslations("admin.reports");
  if (row.reportedUsername || row.reportedUserId) {
    return (
      <div className="flex flex-col">
        <Badge variant="outline" className="w-fit border-sky-400/20 bg-sky-400/10 text-sky-300">
          {t("targetUser")}
        </Badge>
        {row.reportedUserId ? (
          <Link href={`/admin/users/${row.reportedUserId}`} className="mt-1 text-sm font-medium hover:underline">
            {row.reportedUsername ?? `#${row.reportedUserId}`}
          </Link>
        ) : (
          <span className="mt-1 text-sm font-medium">{row.reportedUsername}</span>
        )}
      </div>
    );
  }
  if (row.reportedMessagePreview !== null) {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="w-fit border-violet-400/20 bg-violet-400/10 text-violet-300">
          {t("targetMessage")}
        </Badge>
        <span className="max-w-64 truncate text-sm text-muted-foreground" title={row.reportedMessagePreview}>
          {row.reportedMessagePreview}
        </span>
      </div>
    );
  }
  if (row.emoteName || row.reactableType) {
    return (
      <Badge variant="outline" className="w-fit border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300">
        {row.emoteName ? t("targetEmote", { name: row.emoteName }) : t("targetReaction", { type: row.reactableType ?? "?" })}
      </Badge>
    );
  }
  return <span className="text-sm text-muted-foreground">{t("targetUnknown")}</span>;
}

export function ReportsPanel({
  rows,
  canManage,
  sortable,
}: {
  rows: AdminReportRow[];
  canManage: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  const [reviewing, setReviewing] = useState<{ report: AdminReportRow; action: "resolved" | "dismissed" } | null>(null);
  const [isReopening, startReopen] = useTransition();

  function handleReopen(id: number) {
    startReopen(async () => {
      const result = await reopenReport(id);
      if (!result.ok) {
        toast.error(t("reopenError"));
        return;
      }
      router.refresh();
      toast.success(t("reopenSuccess"));
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <AdminSortableTh pathname={sortable.pathname} col="category" label={t("columnCategory")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <TableHead>{t("columnTarget")}</TableHead>
            <TableHead>{t("columnReason")}</TableHead>
            <TableHead>{t("columnReporter")}</TableHead>
            <TableHead>{t("columnOrganization")}</TableHead>
            <AdminSortableTh pathname={sortable.pathname} col="status" label={t("columnStatus")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <TableHead className="text-right">{t("columnActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id} className={cn(row.status === "pending" && "bg-amber-400/5")}>
              <TableCell className="font-medium">{row.category}</TableCell>
              <TableCell>
                <ReportTarget row={row} />
              </TableCell>
              <TableCell className="max-w-72">
                <p className="truncate text-sm" title={row.reason}>
                  {row.reason}
                </p>
                {row.status !== "pending" && row.resolutionNote && (
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={row.resolutionNote}>
                    {t("noteLabel")}: {row.resolutionNote}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.reporterId ? (
                  <Link href={`/admin/users/${row.reporterId}`} className="hover:underline">
                    {row.reporterUsername ?? t("unknownUser")}
                  </Link>
                ) : (
                  (row.reporterUsername ?? t("unknownUser"))
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.organizationName ?? "–"}</TableCell>
              <TableCell>
                <ReportStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right">
                {canManage && row.status === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setReviewing({ report: row, action: "resolved" })}>
                      <CheckCircle2 className="size-4" />
                      {t("resolveButton")}
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setReviewing({ report: row, action: "dismissed" })}>
                      <XCircle className="size-4" />
                      {t("dismissButton")}
                    </Button>
                  </div>
                ) : canManage && row.status !== "pending" ? (
                  <div className="flex flex-col items-end gap-1">
                    {row.reviewedByUsername && <span className="text-xs text-muted-foreground">{t("reviewedBy", { username: row.reviewedByUsername })}</span>}
                    <Button size="sm" variant="outline" disabled={isReopening} onClick={() => handleReopen(row.id)}>
                      <RotateCcw className="size-4" />
                      {t("reopenButton")}
                    </Button>
                  </div>
                ) : (
                  row.reviewedByUsername && <span className="text-xs text-muted-foreground">{t("reviewedBy", { username: row.reviewedByUsername })}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ReportReviewDialog report={reviewing?.report ?? null} action={reviewing?.action ?? "resolved"} open={reviewing !== null} onOpenChange={(open) => !open && setReviewing(null)} />
    </div>
  );
}

/**
 * GC-Stats - moderation-suspects-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldOff, ShieldCheck } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { ModerationSuspectStatusBadge } from "@/components/admin/moderation-suspect-status-badge";
import { resolveModerationSuspect } from "@/actions/admin-moderation";
import { cn } from "@/lib/utils";
import type { AdminModerationSuspectRow, SortDirection } from "@/lib/admin-moderation-suspects";

export function ModerationSuspectsPanel({
  rows,
  canManage,
  sortable,
}: {
  rows: AdminModerationSuspectRow[];
  canManage: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.moderation");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleResolve(row: AdminModerationSuspectRow, status: "dismissed" | "actioned") {
    startTransition(async () => {
      const result = await resolveModerationSuspect(row.id, status);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      router.refresh();
      toast.success(status === "actioned" ? t("actionedSuccess") : t("dismissSuccess"));
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <AdminSortableTh pathname={sortable.pathname} col="source" label={t("columnSource")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <TableHead>{t("columnUser")}</TableHead>
            <TableHead>{t("columnMatch")}</TableHead>
            <TableHead>{t("columnSnippet")}</TableHead>
            <AdminSortableTh pathname={sortable.pathname} col="status" label={t("columnStatus")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
            <TableHead className="text-right">{t("columnActions")}</TableHead>
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
            <TableRow key={row.id} className={cn(row.status === "pending" && "bg-amber-400/5")}>
              <TableCell className="text-sm text-muted-foreground">{row.source ?? "–"}</TableCell>
              <TableCell className="text-sm font-medium">
                {row.userId ? (
                  <Link href={`/admin/users/${row.userId}`} className="hover:underline">
                    {row.username ?? t("unknownUser")}
                  </Link>
                ) : (
                  (row.username ?? t("unknownUser"))
                )}
              </TableCell>
              <TableCell>
                {row.matchedTerm ? (
                  <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                    {row.matchedTerm}
                  </Badge>
                ) : (
                  "–"
                )}
              </TableCell>
              <TableCell className="max-w-80">
                <p className="truncate text-sm text-muted-foreground" title={row.bodySnapshot}>
                  {row.bodySnapshot}
                </p>
              </TableCell>
              <TableCell>
                <ModerationSuspectStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right">
                {canManage && row.status === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleResolve(row, "actioned")}>
                      <ShieldOff className="size-4" />
                      {t("actionButton")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleResolve(row, "dismissed")}>
                      <ShieldCheck className="size-4" />
                      {t("dismissButton")}
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
    </div>
  );
}

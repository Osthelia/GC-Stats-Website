/**
 * GC-Stats - sanctions-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { SanctionTypeBadge } from "@/components/admin/sanction-type-badge";
import { SanctionStatusBadge } from "@/components/admin/sanction-status-badge";
import { SanctionDialog } from "@/components/admin/sanction-dialog";
import { revokeSanction } from "@/actions/admin-sanctions";
import { cn } from "@/lib/utils";
import type { AdminSanctionRow, SortDirection } from "@/lib/admin-sanctions";

export function SanctionsPanel({
  rows,
  canManage,
  sortable,
}: {
  rows: AdminSanctionRow[];
  canManage: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.sanctions");
  const locale = useLocale();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<AdminSanctionRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    if (!revoking) return;
    const row = revoking;
    startTransition(async () => {
      const result = await revokeSanction(row.id);
      if (!result.ok) {
        setRevoking(null);
        toast.error(t(`error.${result.error}`));
        return;
      }
      setRevoking(null);
      router.refresh();
      toast.success(t("revokeSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        {canManage && <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columnTarget")}</TableHead>
              <AdminSortableTh pathname={sortable.pathname} col="type" label={t("columnType")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead>{t("columnReason")}</TableHead>
              <AdminSortableTh pathname={sortable.pathname} col="startsAt" label={t("columnStartsAt")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead>{t("columnEndsAt")}</TableHead>
              <TableHead>{t("columnStatus")}</TableHead>
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
              <TableRow key={row.id} className={cn(row.status === "active" && row.type === "ban" && "bg-destructive/5")}>
                <TableCell>
                  <div className="flex flex-col">
                    {row.userId ? (
                      <Link href={`/admin/users/${row.userId}`} className="text-sm font-medium hover:underline">
                        {row.username ?? t("unknownTarget")}
                      </Link>
                    ) : row.teamId ? (
                      <Link href={`/admin/teams/${row.teamId}`} className="text-sm font-medium hover:underline">
                        {row.teamName ?? t("unknownTarget")}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{t("unknownTarget")}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{row.teamId ? t("targetTeam") : t("targetUser")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <SanctionTypeBadge type={row.type} />
                </TableCell>
                <TableCell className="max-w-64">
                  <p className="truncate text-sm text-muted-foreground" title={row.reason}>
                    {row.reason}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(row.startsAt).toLocaleString(locale)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.endsAt ? new Date(row.endsAt).toLocaleString(locale) : t("noExpiry")}</TableCell>
                <TableCell>
                  <SanctionStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && row.status !== "revoked" ? (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => setRevoking(row)}>
                      <Undo2 className="size-4" />
                      {t("revokeButton")}
                    </Button>
                  ) : (
                    row.revokedByUsername && <span className="text-xs text-muted-foreground">{t("revokedBy", { username: row.revokedByUsername })}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SanctionDialog open={creating} onOpenChange={setCreating} />

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t("revokeTitle")}
        description={t("revokeConfirm")}
        confirmLabel={t("revokeButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleRevoke}
        isPending={isPending}
        destructive
      />
    </div>
  );
}

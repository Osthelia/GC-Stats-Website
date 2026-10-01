/**
 * GC-Stats - forum-messages-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { EyeOff, Eye, Trash2, RotateCcw, ExternalLink, ShieldAlert } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { ForumMessageStatusBadge } from "@/components/admin/forum-message-status-badge";
import { SanctionDialog } from "@/components/admin/sanction-dialog";
import { hideForumMessage, unhideForumMessage, deleteForumMessage, restoreForumMessage } from "@/actions/admin-forum";
import { cn } from "@/lib/utils";
import type { AdminForumMessageRow, SortDirection } from "@/lib/admin-forum-messages";

const CATEGORY_STYLES: Record<string, string> = {
  tournament: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  match: "border-violet-400/20 bg-violet-400/10 text-violet-300",
  news: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300",
  general: "border-border bg-muted text-muted-foreground",
};

export function ForumMessagesPanel({
  rows,
  canManage,
  canSanction = false,
  sortable,
}: {
  rows: AdminForumMessageRow[];
  canManage: boolean;
  /** Adds a per-row "Sanction" button targeting that message's author (hidden on system/deleted-account messages). */
  canSanction?: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
}) {
  const t = useTranslations("admin.forum");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sanctionTarget, setSanctionTarget] = useState<{ id: string; username: string | null } | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: "notFound" }>, successKey: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      router.refresh();
      toast.success(t(successKey));
    });
  }

  function handleDelete(row: AdminForumMessageRow) {
    if (!window.confirm(t("deleteConfirm"))) return;
    run(() => deleteForumMessage(row.id), "deleteSuccess");
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columnThread")}</TableHead>
            <TableHead>{t("columnAuthor")}</TableHead>
            <TableHead>{t("columnMessage")}</TableHead>
            <AdminSortableTh pathname={sortable.pathname} col="createdAt" label={t("columnCreatedAt")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
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
            <TableRow key={row.id} className={cn(row.status === "deleted" && "opacity-60")}>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className={cn("w-fit", CATEGORY_STYLES[row.threadCategory] ?? CATEGORY_STYLES.general)}>
                    {t.has(`category.${row.threadCategory}`) ? t(`category.${row.threadCategory}`) : row.threadCategory}
                  </Badge>
                  {row.threadTitle && <span className="max-w-48 truncate text-xs text-muted-foreground">{row.threadTitle}</span>}
                </div>
              </TableCell>
              <TableCell className="text-sm font-medium">
                {row.userId ? (
                  <Link href={`/admin/users/${row.userId}`} className="hover:underline">
                    {row.username ?? t("unknownUser")}
                  </Link>
                ) : (
                  (row.username ?? t("unknownUser"))
                )}
              </TableCell>
              <TableCell className="max-w-80">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm text-muted-foreground" title={row.body}>
                    {row.body}
                  </p>
                  <a href={row.link} target="_blank" rel="noopener noreferrer" title={t("viewMessageButton")} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{new Date(row.createdAt).toLocaleString(locale)}</TableCell>
              <TableCell>
                <ForumMessageStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right">
                {(canManage || canSanction) && (
                  <div className="flex justify-end gap-2">
                    {canSanction && row.userId && (
                      <Button size="sm" variant="outline" onClick={() => setSanctionTarget({ id: row.userId!, username: row.username })}>
                        <ShieldAlert className="size-4" />
                        {t("sanctionButton")}
                      </Button>
                    )}
                    {canManage && row.status !== "deleted" && row.status !== "hidden" && (
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => hideForumMessage(row.id), "hideSuccess")}>
                        <EyeOff className="size-4" />
                        {t("hideButton")}
                      </Button>
                    )}
                    {canManage && row.status === "hidden" && (
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => unhideForumMessage(row.id), "unhideSuccess")}>
                        <Eye className="size-4" />
                        {t("unhideButton")}
                      </Button>
                    )}
                    {canManage &&
                      (row.status !== "deleted" ? (
                        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleDelete(row)}>
                          <Trash2 className="size-4" />
                          {t("deleteButton")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => restoreForumMessage(row.id), "restoreSuccess")}>
                          <RotateCcw className="size-4" />
                          {t("restoreButton")}
                        </Button>
                      ))}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canSanction && (
        <SanctionDialog open={sanctionTarget !== null} onOpenChange={(open) => !open && setSanctionTarget(null)} initialUser={sanctionTarget} />
      )}
    </div>
  );
}

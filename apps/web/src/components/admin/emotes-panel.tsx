/**
 * GC-Stats - emotes-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AboutProjectLogo } from "@/components/admin/about-project-logo";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { EmoteDialog } from "@/components/admin/emote-dialog";
import { deleteEmote } from "@/actions/admin-emotes";
import type { AdminEmoteRow, SortDirection } from "@/lib/admin-emotes";

export function EmotesPanel({
  emotes,
  canManage,
  sortable,
  pagination,
  existingSources,
}: {
  emotes: AdminEmoteRow[];
  canManage: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
  pagination: { page: number; totalPages: number; total: number };
  existingSources: string[];
}) {
  const t = useTranslations("admin.emotes");
  const router = useRouter();
  const [editing, setEditing] = useState<AdminEmoteRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(emote: AdminEmoteRow) {
    if (!window.confirm(t("deleteConfirm", { name: emote.name }))) return;
    startTransition(async () => {
      const result = await deleteEmote(emote.id);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      router.refresh();
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        {canManage && <Button onClick={() => setCreating(true)}>{t("createButton")}</Button>}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname={sortable.pathname} col="name" label={t("columnName")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="source" label={t("columnSource")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="status" label={t("columnStatus")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {emotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {emotes.map((emote) => (
              <TableRow key={emote.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <AboutProjectLogo src={emote.imagePath} alt={emote.name} />
                    <span className="font-medium">{emote.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{emote.source}</Badge>
                </TableCell>
                <TableCell>
                  <ActiveStatusBadge active={emote.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(emote)}>
                        {t("editButton")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleDelete(emote)} className="text-destructive hover:text-destructive">
                        {t("deleteButton")}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        pathname={sortable.pathname}
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        query={sortable.query}
        label={t("resultsCount", { count: pagination.total })}
      />

      <EmoteDialog emote={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} existingSources={existingSources} />
      <EmoteDialog emote={null} open={creating} onOpenChange={setCreating} existingSources={existingSources} />
    </div>
  );
}

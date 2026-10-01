/**
 * GC-Stats - news-languages-panel
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
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { NewsLanguageDialog } from "@/components/admin/news-language-dialog";
import { ActiveStatusBadge } from "@/components/admin/active-status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteNewsLanguage } from "@/actions/admin-news-languages";
import type { AdminNewsLanguageRow, SortDirection } from "@/lib/admin-news-languages";

export function NewsLanguagesPanel({
  languages,
  canManage,
  sortable,
  pagination,
}: {
  languages: AdminNewsLanguageRow[];
  canManage: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
  pagination: { page: number; totalPages: number; total: number };
}) {
  const t = useTranslations("admin.newsLanguages");
  const router = useRouter();
  const [editing, setEditing] = useState<AdminNewsLanguageRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminNewsLanguageRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(language: AdminNewsLanguageRow) {
    startTransition(async () => {
      const result = await deleteNewsLanguage(language.code);
      setDeleting(null);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
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
              <AdminSortableTh pathname={sortable.pathname} col="code" label={t("columnCode")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="name" label={t("columnName")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="sortOrder" label={t("columnSortOrder")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead>{t("columnStatus")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {languages.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {languages.map((language) => (
              <TableRow key={language.code}>
                <TableCell className="font-mono text-sm font-medium">{language.code}</TableCell>
                <TableCell>{language.name}</TableCell>
                <TableCell>{language.sortOrder}</TableCell>
                <TableCell>
                  <ActiveStatusBadge active={language.isActive} activeLabel={t("statusActive")} inactiveLabel={t("statusInactive")} />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(language)}>
                        {t("editButton")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => setDeleting(language)} className="text-destructive hover:text-destructive">
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
        label={`${pagination.total}`}
      />

      <NewsLanguageDialog language={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <NewsLanguageDialog language={null} open={creating} onOpenChange={setCreating} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("confirmTitle")}
        description={deleting ? t("deleteConfirm", { name: deleting.name }) : ""}
        confirmLabel={t("deleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={() => deleting && handleDelete(deleting)}
        isPending={isPending}
        destructive
      />
    </div>
  );
}

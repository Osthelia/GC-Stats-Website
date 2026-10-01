/**
 * GC-Stats - finance-table
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { FinanceEntryDialog } from "@/components/admin/finance-entry-dialog";
import { deleteFinanceEntry } from "@/actions/admin-finance";
import type { AdminFinanceEntry, FinanceSort, SortDirection } from "@/lib/admin-finance";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";

export function FinanceTable({
  entries,
  sort,
  direction,
  query,
  canManage,
}: {
  entries: AdminFinanceEntry[];
  sort: FinanceSort;
  direction: SortDirection;
  query: Record<string, string>;
  canManage: boolean;
}) {
  const t = useTranslations("admin.finance");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<AdminFinanceEntry | null>(null);
  const [deleting, setDeleting] = useState<AdminFinanceEntry | null>(null);
  const [isPending, startTransition] = useTransition();

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "USD" });

  const categoryLabel = (category: string) =>
    (FINANCE_CATEGORIES as readonly string[]).includes(category) ? t(`category.${category}`) : category;

  function handleDelete() {
    if (!deleting) return;
    const entry = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteFinanceEntry(entry.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("deleteSuccess"));
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableTh pathname="/admin/finance" col="date" label={t("columnDate")} currentSort={sort} currentDirection={direction} query={query} />
              <AdminSortableTh pathname="/admin/finance" col="label" label={t("columnLabel")} currentSort={sort} currentDirection={direction} query={query} />
              <AdminSortableTh pathname="/admin/finance" col="category" label={t("columnCategory")} currentSort={sort} currentDirection={direction} query={query} />
              <AdminSortableTh pathname="/admin/finance" col="amount" label={t("columnAmount")} currentSort={sort} currentDirection={direction} query={query} className="text-right" />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{dateFmt.format(new Date(entry.entryDate))}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{entry.label}</span>
                    {entry.description && <span className="max-w-xs truncate text-xs text-muted-foreground">{entry.description}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{categoryLabel(entry.category)}</Badge>
                </TableCell>
                <TableCell className={`whitespace-nowrap text-right font-medium ${entry.type === "income" ? "text-emerald-500" : "text-red-500"}`}>
                  {entry.type === "income" ? "+" : "-"}
                  {money.format(Number(entry.amountUsd))}
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(entry)}>
                        {t("editButton")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending && deleting?.id === entry.id}
                        onClick={() => setDeleting(entry)}
                        className="text-destructive hover:text-destructive"
                      >
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

      <FinanceEntryDialog entry={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("confirmTitle")}
        description={deleting ? t("deleteConfirm", { label: deleting.label }) : ""}
        confirmLabel={t("deleteButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
      />
    </>
  );
}

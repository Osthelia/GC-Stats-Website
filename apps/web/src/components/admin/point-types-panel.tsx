/**
 * GC-Stats - point-types-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableTh } from "@/components/admin/admin-sortable-th";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { PointTypeDialog } from "@/components/admin/point-type-dialog";
import { deletePointType } from "@/actions/admin-point-types";
import { cn } from "@/lib/utils";
import type { AdminPointTypeRow, SortDirection } from "@/lib/admin-point-types";

type PointTypeValidity = "active" | "upcoming" | "expired";

const VALIDITY_STYLES: Record<PointTypeValidity, string> = {
  active: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  upcoming: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  expired: "bg-muted text-muted-foreground border-border",
};

// Derived from start/end date, not stored — a point type has no status column of its own.
function pointTypeValidity(pointType: AdminPointTypeRow): PointTypeValidity {
  const today = new Date().toISOString().slice(0, 10);
  if (today < pointType.startDate.slice(0, 10)) return "upcoming";
  if (today > pointType.endDate.slice(0, 10)) return "expired";
  return "active";
}

export function PointTypesPanel({
  pointTypes,
  canManage,
  sortable,
  pagination,
}: {
  pointTypes: AdminPointTypeRow[];
  canManage: boolean;
  sortable: { pathname: string; sort: string; direction: SortDirection; query: Record<string, string> };
  pagination: { page: number; totalPages: number; total: number };
}) {
  const t = useTranslations("admin.pointTypes");
  const locale = useLocale();
  const router = useRouter();
  const validityLabels: Record<PointTypeValidity, string> = { active: t("statusActive"), upcoming: t("statusUpcoming"), expired: t("statusExpired") };
  const [editing, setEditing] = useState<AdminPointTypeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Calendar dates (no time component, no timezone) — mirrors finance-ledger.tsx,
  // which deliberately skips <FormattedDate> (timezone-aware) for the same reason.
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }), [locale]);
  const formatDate = (value: string) => dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00`));

  function handleDelete(pointType: AdminPointTypeRow) {
    if (!window.confirm(t("deleteConfirm", { name: pointType.name }))) return;
    startTransition(async () => {
      const result = await deletePointType(pointType.id);
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
              <AdminSortableTh pathname={sortable.pathname} col="label" label={t("columnLabel")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="startDate" label={t("columnStartDate")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <AdminSortableTh pathname={sortable.pathname} col="endDate" label={t("columnEndDate")} currentSort={sortable.sort} currentDirection={sortable.direction} query={sortable.query} />
              <TableHead>{t("columnStatus")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pointTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {pointTypes.map((pointType) => {
              const validity = pointTypeValidity(pointType);
              return (
              <TableRow key={pointType.id}>
                <TableCell className="font-medium">{pointType.name}</TableCell>
                <TableCell>{pointType.label}</TableCell>
                <TableCell>{formatDate(pointType.startDate)}</TableCell>
                <TableCell>{formatDate(pointType.endDate)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(VALIDITY_STYLES[validity])}>
                    {validityLabels[validity]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(pointType)}>
                        {t("editButton")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleDelete(pointType)} className="text-destructive hover:text-destructive">
                        {t("deleteButton")}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
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

      <PointTypeDialog pointType={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <PointTypeDialog pointType={null} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

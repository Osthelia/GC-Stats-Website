/**
 * GC-Stats - tournament-entrants-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableThClient } from "@/components/admin/admin-sortable-th-client";
import { AdminColumnFilterBar, type AdminActiveFilter } from "@/components/admin/admin-column-filter-bar";
import { EntrantDialog } from "@/components/admin/entrant-dialog";
import { QuickAddEntrant } from "@/components/admin/quick-add-entrant";
import { QualificationSourceLabel } from "@/components/tournament/qualification-source-label";
import { removeEntrant } from "@/actions/admin-tournament-entrants";
import { stripAccents, typoVariants } from "@/lib/search-typo";
import type { AdminEntrantRow } from "@/lib/admin-tournament-detail";

type SortCol = "seed" | "name" | "type" | "qualification";
type Direction = "asc" | "desc";

function compare(a: AdminEntrantRow, b: AdminEntrantRow, col: SortCol): number {
  switch (col) {
    case "seed":
      return (a.seed ?? Number.POSITIVE_INFINITY) - (b.seed ?? Number.POSITIVE_INFINITY);
    case "name":
      return a.displayName.localeCompare(b.displayName);
    case "type":
      return a.kind.localeCompare(b.kind);
    case "qualification":
      return (a.qualificationSource?.tournamentName ?? a.qualificationSource?.pointTypeLabel ?? a.qualificationSource?.type ?? "").localeCompare(b.qualificationSource?.tournamentName ?? b.qualificationSource?.pointTypeLabel ?? b.qualificationSource?.type ?? "");
  }
}

export function TournamentEntrantsPanel({ tournamentId, entrants, pointTypeOptions, canManage }: { tournamentId: number; entrants: AdminEntrantRow[]; pointTypeOptions: { id: number; label: string }[]; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.entrants");
  const tSource = useTranslations("qualificationSource");
  const router = useRouter();
  const [editing, setEditing] = useState<AdminEntrantRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sort, setSort] = useState<SortCol>("seed");
  const [direction, setDirection] = useState<Direction>("asc");
  const [filters, setFilters] = useState<AdminActiveFilter[]>([]);

  function handleSort(col: SortCol) {
    if (col === sort) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDirection("asc");
    }
  }

  function handleRemove(entrant: AdminEntrantRow) {
    if (!window.confirm(t("removeConfirm", { name: entrant.displayName }))) return;
    startTransition(async () => {
      const result = await removeEntrant(entrant.id, tournamentId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("removeSuccess"));
    });
  }

  function cellSearchValue(entrant: AdminEntrantRow, field: string): string {
    if (field === "name") return entrant.displayName;
    if (field === "type") return t(entrant.kind === "team" ? "kindTeam" : "kindPlaceholder");
    if (field === "seed") return entrant.seed != null ? String(entrant.seed) : "";
    if (field === "qualification") return entrant.qualificationSource ? (entrant.qualificationSource.tournamentName ?? entrant.qualificationSource.pointTypeLabel ?? tSource(entrant.qualificationSource.type)) : "";
    return "";
  }

  const filterColumns = useMemo(() => [{ value: "name", label: t("columnName") }, { value: "type", label: t("columnType") }, { value: "seed", label: t("columnSeed") }, { value: "qualification", label: t("columnQualification") }], [t]);

  const rows = useMemo(() => {
    const filtered =
      filters.length === 0
        ? entrants
        : entrants.filter((e) =>
            filters.every((f) => {
              const cell = stripAccents(cellSearchValue(e, f.field).toLowerCase());
              return typoVariants(f.value.toLowerCase()).some((variant) => cell.includes(variant));
            })
          );
    const copy = [...filtered];
    copy.sort((a, b) => compare(a, b, sort) * (direction === "asc" ? 1 : -1));
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrants, filters, sort, direction]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <AdminColumnFilterBar columns={filterColumns} activeFilters={filters} onApply={setFilters} />
      </div>

      {canManage && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">{t("quickAddHeading")}</span>
          <QuickAddEntrant tournamentId={tournamentId} />
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableThClient col="seed" label={t("columnSeed")} sort={sort} direction={direction} onSort={handleSort} />
              <AdminSortableThClient col="name" label={t("columnName")} sort={sort} direction={direction} onSort={handleSort} />
              <AdminSortableThClient col="type" label={t("columnType")} sort={sort} direction={direction} onSort={handleSort} />
              <AdminSortableThClient col="qualification" label={t("columnQualification")} sort={sort} direction={direction} onSort={handleSort} />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((entrant) => (
              <TableRow key={entrant.id}>
                <TableCell className="text-muted-foreground">{entrant.seed ?? "-"}</TableCell>
                <TableCell className="font-medium">{entrant.displayName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={entrant.kind === "team" ? "border-sky-400/20 bg-sky-400/10 text-sky-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}>
                    {t(entrant.kind === "team" ? "kindTeam" : "kindPlaceholder")}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[220px] text-sm whitespace-normal">
                  {entrant.qualificationSource ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <QualificationSourceLabel source={entrant.qualificationSource} />
                      <Badge variant="outline" className="text-[10px]">
                        {t(entrant.qualificationSource.origin === "auto" ? "originAuto" : "originManual")}
                      </Badge>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(entrant)}>
                        {t("editButton")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleRemove(entrant)} className="text-destructive hover:text-destructive">
                        {t("removeButton")}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EntrantDialog tournamentId={tournamentId} pointTypeOptions={pointTypeOptions} entrant={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  );
}

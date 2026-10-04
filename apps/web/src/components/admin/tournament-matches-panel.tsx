/**
 * GC-Stats - tournament-matches-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableThClient } from "@/components/admin/admin-sortable-th-client";
import { AdminColumnFilterBar, type AdminActiveFilter } from "@/components/admin/admin-column-filter-bar";
import { matchStatusBadgeClass } from "@/lib/status-colors";
import { formatSideScore } from "@/lib/match-score-format";
import type { AdminMatchListRow } from "@/lib/admin-matches";
import { useDisplayTimezone } from "@/lib/site-settings";

type SortCol = "container" | "round" | "entrantA" | "entrantB" | "status" | "scheduledAt";
type Direction = "asc" | "desc";

function compare(a: AdminMatchListRow, b: AdminMatchListRow, col: SortCol): number {
  switch (col) {
    case "container":
      return `${a.stageName} ${a.containerName}`.localeCompare(`${b.stageName} ${b.containerName}`);
    case "round":
      return a.round - b.round;
    case "entrantA":
      return (a.entrantAName ?? "").localeCompare(b.entrantAName ?? "");
    case "entrantB":
      return (a.entrantBName ?? "").localeCompare(b.entrantBName ?? "");
    case "status":
      return a.status.localeCompare(b.status);
    case "scheduledAt":
      return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
  }
}

export function TournamentMatchesPanel({ tournamentId, matches }: { tournamentId: number; matches: AdminMatchListRow[] }) {
  const t = useTranslations("admin.tournaments.matches");
  const locale = useLocale();
  const [sort, setSort] = useState<SortCol>("container");
  const [direction, setDirection] = useState<Direction>("asc");
  const [filters, setFilters] = useState<AdminActiveFilter[]>([]);

  const timeZone = useDisplayTimezone();
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone }), [locale, timeZone]);

  function handleSort(col: SortCol) {
    if (col === sort) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDirection("asc");
    }
  }

  function cellSearchValue(match: AdminMatchListRow, field: string): string {
    switch (field) {
      case "container":
        return `${match.stageName} ${match.containerName}`;
      case "entrantA":
        return match.entrantAName ?? "";
      case "entrantB":
        return match.entrantBName ?? "";
      case "status":
        return t(`status.${match.status}`);
      default:
        return "";
    }
  }

  const filterColumns = useMemo(
    () => [
      { value: "container", label: t("columnContainer") },
      { value: "entrantA", label: t("columnEntrantA") },
      { value: "entrantB", label: t("columnEntrantB") },
      { value: "status", label: t("columnStatus") },
    ],
    [t],
  );

  const rows = useMemo(() => {
    const filtered = filters.length === 0 ? matches : matches.filter((m) => filters.every((f) => cellSearchValue(m, f.field).toLowerCase().includes(f.value.toLowerCase())));
    const copy = [...filtered];
    copy.sort((a, b) => compare(a, b, sort) * (direction === "asc" ? 1 : -1));
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, filters, sort, direction]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("listHeading")}</h2>
        <AdminColumnFilterBar columns={filterColumns} activeFilters={filters} onApply={setFilters} />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <AdminSortableThClient col="container" label={t("columnContainer")} sort={sort} direction={direction} onSort={handleSort} />
              <AdminSortableThClient col="round" label={t("columnRound")} sort={sort} direction={direction} onSort={handleSort} />
              <AdminSortableThClient col="entrantA" label={t("columnEntrantA")} sort={sort} direction={direction} onSort={handleSort} />
              <AdminSortableThClient col="entrantB" label={t("columnEntrantB")} sort={sort} direction={direction} onSort={handleSort} />
              <TableHead>{t("columnScore")}</TableHead>
              <AdminSortableThClient col="status" label={t("columnStatus")} sort={sort} direction={direction} onSort={handleSort} />
              <AdminSortableThClient col="scheduledAt" label={t("columnScheduledAt")} sort={sort} direction={direction} onSort={handleSort} />
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {t("listEmpty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((match) => (
              <TableRow key={match.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {match.stageName} · {match.containerName}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{match.round}</TableCell>
                <TableCell className="font-medium">{match.entrantAName ?? t("tbdLabel")}</TableCell>
                <TableCell className="font-medium">{match.entrantBName ?? t("tbdLabel")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {match.scoreA !== null && match.scoreB !== null
                    ? `${formatSideScore(match.scoreA, match.entrantAId)} - ${formatSideScore(match.scoreB, match.entrantBId)}`
                    : "–"}
                </TableCell>
                <TableCell>
                  <Badge className={matchStatusBadgeClass(match.status)}>{t(`status.${match.status}`)}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{match.scheduledAt ? dateFormat.format(new Date(match.scheduledAt)) : "–"}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/tournaments/${tournamentId}/matches/${match.id}`} className="text-sm text-primary hover:underline">
                    {t("viewButton")}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

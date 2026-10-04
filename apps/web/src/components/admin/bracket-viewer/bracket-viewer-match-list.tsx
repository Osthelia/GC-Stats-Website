/**
 * GC-Stats - bracket-viewer-match-list
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminSortableThClient } from "@/components/admin/admin-sortable-th-client";
import { matchStatusBadgeClass } from "@/lib/status-colors";
import { formatSideScore } from "@/lib/match-score-format";
import type { PublicBracketMatch } from "@/lib/tournament-bracket-data";
import { useDisplayTimezone } from "@/lib/site-settings";

type SortCol = "round" | "entrantA" | "entrantB" | "status" | "scheduledAt";
type Direction = "asc" | "desc";

const ANY = "any";
const MATCH_STATUSES = ["pending", "live", "completed"] as const;

function compare(a: PublicBracketMatch, b: PublicBracketMatch, col: SortCol): number {
  switch (col) {
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

/**
 * Conventional match list (round/entrants/score/status/date, sortable) for a
 * Swiss or round-robin container — explicit user request (2026-09-14): on
 * the bracket viewer, group containers show ONLY this list, never a
 * standings table or the bracket canvas. Filter is a simple row of controls
 * (status dropdown, team dropdown, round field) rather than the generic
 * column-filter dialog used elsewhere — explicit user request right after:
 * "Le filtre, fais plus simple, dropdown par status, team, champ round".
 * Reuses `admin.tournaments.matches` (same vocabulary as
 * TournamentMatchesPanel) rather than a new namespace.
 */
export function BracketViewerMatchList({ tournamentId, matches }: { tournamentId: number; matches: PublicBracketMatch[] }) {
  const t = useTranslations("admin.tournaments.matches");
  const locale = useLocale();
  const [sort, setSort] = useState<SortCol>("round");
  const [direction, setDirection] = useState<Direction>("asc");
  const [statusFilter, setStatusFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [roundFilter, setRoundFilter] = useState("");

  const timeZone = useDisplayTimezone();
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone }), [locale, timeZone]);

  function handleSort(col: SortCol) {
    if (col === sort) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDirection("asc");
    }
  }

  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    for (const m of matches) {
      if (m.entrantAName) names.add(m.entrantAName);
      if (m.entrantBName) names.add(m.entrantBName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const rows = useMemo(() => {
    const filtered = matches.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (teamFilter && m.entrantAName !== teamFilter && m.entrantBName !== teamFilter) return false;
      if (roundFilter && String(m.round) !== roundFilter.trim()) return false;
      return true;
    });
    const copy = [...filtered];
    copy.sort((a, b) => compare(a, b, sort) * (direction === "asc" ? 1 : -1));
    return copy;
  }, [matches, statusFilter, teamFilter, roundFilter, sort, direction]);

  if (matches.length === 0) {
    return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{t("listEmpty")}</p>;
  }

  const statusItems: Record<string, string> = { [ANY]: t("filterStatusAny"), ...Object.fromEntries(MATCH_STATUSES.map((s) => [s, t(`status.${s}`)])) };
  const teamItems: Record<string, string> = { [ANY]: t("filterTeamAny"), ...Object.fromEntries(teamOptions.map((name) => [name, name])) };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select items={statusItems} value={statusFilter || ANY} onValueChange={(v) => setStatusFilter(v && v !== ANY ? v : "")}>
          <SelectTrigger aria-label={t("filterStatusLabel")} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={teamItems} value={teamFilter || ANY} onValueChange={(v) => setTeamFilter(v && v !== ANY ? v : "")}>
          <SelectTrigger aria-label={t("filterTeamLabel")} className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(teamItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={1}
          value={roundFilter}
          onChange={(e) => setRoundFilter(e.target.value)}
          placeholder={t("filterRoundPlaceholder")}
          aria-label={t("columnRound")}
          className="w-28"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  {t("listEmpty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((match) => (
              <TableRow key={match.id} className="odd:bg-muted/20">
                <TableCell className="text-sm text-muted-foreground">{match.round}</TableCell>
                <TableCell className="font-medium">{match.entrantAName ?? t("tbdLabel")}</TableCell>
                <TableCell className="font-medium">{match.entrantBName ?? t("tbdLabel")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {match.scoreA !== null && match.scoreB !== null ? `${formatSideScore(match.scoreA, match.entrantAId)} - ${formatSideScore(match.scoreB, match.entrantBId)}` : "–"}
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

/**
 * GC-Stats - bulk-match-status-card
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/admin/form-field";
import { AdminSortableThClient } from "@/components/admin/admin-sortable-th-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { matchStatusBadgeClass } from "@/lib/status-colors";
import { bulkSetMatchStatus, type MatchStatus } from "@/actions/admin-tournament-operations";
import type { AdminContainerOption } from "@/lib/admin-tournament-detail";
import type { AdminMatchListRow } from "@/lib/admin-matches";
import { useDisplayTimezone } from "@/lib/site-settings";
import { zonedInputToIso } from "@/lib/datetime-local";

const ALL = "all";
const STATUSES: MatchStatus[] = ["pending", "live", "completed"];

type SortCol = "phase" | "round" | "scheduledAt" | "status";
type Direction = "asc" | "desc";

export function BulkMatchStatusCard({ tournamentId, containers, matches }: { tournamentId: number; containers: AdminContainerOption[]; matches: AdminMatchListRow[] }) {
  const t = useTranslations("admin.tournaments.operations");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [stageFilter, setStageFilter] = useState(ALL);
  const [containerFilter, setContainerFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortCol>("scheduledAt");
  const [direction, setDirection] = useState<Direction>("asc");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetStatus, setTargetStatus] = useState<MatchStatus>("completed");

  const timeZone = useDisplayTimezone();
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }), [locale, timeZone]);

  // `containers` is already ordered by stage sequence then container id —
  // its index is the "phase" order.
  const phaseOrder = useMemo(() => new Map(containers.map((c, i) => [c.id, i])), [containers]);
  const stageNames = useMemo(() => [...new Set(containers.map((c) => c.stageName))], [containers]);
  const containerChoices = stageFilter === ALL ? containers : containers.filter((c) => c.stageName === stageFilter);

  const rows = useMemo(() => {
    const from = dateFrom ? new Date(zonedInputToIso(`${dateFrom}T00:00`, timeZone) ?? NaN).getTime() : null;
    const to = dateTo ? new Date(zonedInputToIso(`${dateTo}T23:59`, timeZone) ?? NaN).getTime() + 59_999 : null;
    const filtered = matches.filter((m) => {
      if (stageFilter !== ALL && m.stageName !== stageFilter) return false;
      if (containerFilter !== ALL && String(m.containerId) !== containerFilter) return false;
      if (statusFilter !== ALL && m.status !== statusFilter) return false;
      if (from !== null || to !== null) {
        if (!m.scheduledAt) return false;
        const time = new Date(m.scheduledAt).getTime();
        if (from !== null && time < from) return false;
        if (to !== null && time > to) return false;
      }
      return true;
    });
    const byPhase = (a: AdminMatchListRow, b: AdminMatchListRow) => (phaseOrder.get(a.containerId) ?? 0) - (phaseOrder.get(b.containerId) ?? 0) || a.round - b.round || a.id - b.id;
    const compare = (a: AdminMatchListRow, b: AdminMatchListRow): number => {
      switch (sort) {
        case "phase":
          return byPhase(a, b);
        case "round":
          return a.round - b.round || byPhase(a, b);
        case "status":
          return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || byPhase(a, b);
        case "scheduledAt":
          return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") || byPhase(a, b);
      }
    };
    return filtered.sort((a, b) => {
      // Unscheduled matches always last, whatever the direction.
      if (sort === "scheduledAt" && (!a.scheduledAt || !b.scheduledAt)) return (a.scheduledAt ? 0 : 1) - (b.scheduledAt ? 0 : 1) || byPhase(a, b);
      return compare(a, b) * (direction === "asc" ? 1 : -1);
    });
  }, [matches, stageFilter, containerFilter, statusFilter, dateFrom, dateTo, timeZone, sort, direction, phaseOrder]);

  const visibleSelected = rows.filter((m) => selected.has(m.id));
  const allVisibleSelected = rows.length > 0 && visibleSelected.length === rows.length;

  function handleSort(col: SortCol) {
    if (col === sort) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDirection("asc");
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of rows) {
        if (allVisibleSelected) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });
  }

  function handleStageChange(value: string) {
    setStageFilter(value);
    setContainerFilter(ALL);
  }

  function handleApply() {
    setConfirmOpen(false);
    const ids = visibleSelected.map((m) => m.id);
    startTransition(async () => {
      const result = await bulkSetMatchStatus(tournamentId, ids, targetStatus);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("statusSuccess", { count: result.updated }));
      if (result.skippedNoResult > 0) toast.warning(t("statusSkippedNoResult", { count: result.skippedNoResult }));
      setSelected(new Set());
      router.refresh();
    });
  }

  const statusLabel = (s: MatchStatus) => t(`status.${s}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("statusSectionTitle")}</CardTitle>
        <CardDescription>{t("statusSectionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label={t("fieldStage")} htmlFor="op-status-stage">
            <Select items={{ [ALL]: t("fieldStageAll"), ...Object.fromEntries(stageNames.map((s) => [s, s])) }} value={stageFilter} onValueChange={(v) => v && handleStageChange(v)}>
              <SelectTrigger id="op-status-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("fieldStageAll")}</SelectItem>
                {stageNames.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("fieldContainerScope")} htmlFor="op-status-container">
            <Select
              items={{ [ALL]: t("fieldContainerScopeAll"), ...Object.fromEntries(containerChoices.map((c) => [String(c.id), `${c.stageName} · ${c.name}`])) }}
              value={containerFilter}
              onValueChange={(v) => v && setContainerFilter(v)}
            >
              <SelectTrigger id="op-status-container" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("fieldContainerScopeAll")}</SelectItem>
                {containerChoices.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.stageName} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("fieldCurrentStatus")} htmlFor="op-status-current">
            <Select items={{ [ALL]: t("fieldCurrentStatusAll"), ...Object.fromEntries(STATUSES.map((s) => [s, statusLabel(s)])) }} value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger id="op-status-current" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("fieldCurrentStatusAll")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("fieldDateFrom")} htmlFor="op-status-date-from">
            <Input id="op-status-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </FormField>
          <FormField label={t("fieldDateTo")} htmlFor="op-status-date-to">
            <Input id="op-status-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </FormField>
        </div>

        <div className="max-h-[480px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allVisibleSelected} disabled={rows.length === 0} onCheckedChange={toggleAllVisible} aria-label={t("selectAllVisible")} />
                </TableHead>
                <AdminSortableThClient col="phase" label={t("columnPhase")} sort={sort} direction={direction} onSort={handleSort} />
                <AdminSortableThClient col="round" label={t("columnRound")} sort={sort} direction={direction} onSort={handleSort} />
                <TableHead>{t("columnMatch")}</TableHead>
                <AdminSortableThClient col="status" label={t("columnStatus")} sort={sort} direction={direction} onSort={handleSort} />
                <AdminSortableThClient col="scheduledAt" label={t("columnScheduledAt")} sort={sort} direction={direction} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {t("statusListEmpty")}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((m) => (
                <TableRow key={m.id} data-state={selected.has(m.id) ? "selected" : undefined} className="cursor-pointer" onClick={() => toggle(m.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.stageName} · {m.containerName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.round}</TableCell>
                  <TableCell className="font-medium">
                    {m.entrantAName ?? t("tbdLabel")} <span className="text-muted-foreground">vs</span> {m.entrantBName ?? t("tbdLabel")}
                  </TableCell>
                  <TableCell>
                    <Badge className={matchStatusBadgeClass(m.status)}>{statusLabel(m.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.scheduledAt ? dateFormat.format(new Date(m.scheduledAt)) : "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <p className="text-sm text-muted-foreground">{t("statusSelectedCount", { selected: visibleSelected.length, total: rows.length })}</p>
          <FormField label={t("fieldTargetStatus")} htmlFor="op-status-target" className="ml-auto w-48">
            <Select items={Object.fromEntries(STATUSES.map((s) => [s, statusLabel(s)]))} value={targetStatus} onValueChange={(v) => v && setTargetStatus(v as MatchStatus)}>
              <SelectTrigger id="op-status-target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <Button onClick={() => setConfirmOpen(true)} disabled={isPending || visibleSelected.length === 0}>
            {isPending ? t("statusSubmitting") : t("statusSubmitButton")}
          </Button>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("statusSectionTitle")}
          description={t("statusConfirm", { count: visibleSelected.length, status: statusLabel(targetStatus) })}
          confirmLabel={t("statusSubmitButton")}
          cancelLabel={t("cancel")}
          onConfirm={handleApply}
        />
      </CardContent>
    </Card>
  );
}

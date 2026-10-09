/**
 * GC-Stats - production-target-picker
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ChevronRightIcon, Loader2Icon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RequiredMark } from "@/components/admin/required-mark";
import { searchTournamentsForCredit, getMatchOptionsForCredit, getMapOptionsForCredit } from "@/actions/dashboard-production-credits";
import type { ProductionCreditScope } from "@/lib/production-credit-validation";

export type SelectedTarget = {
  scope: ProductionCreditScope;
  id: number;
  label: string;
  /** Names of the enclosing levels, outermost first, shown in the summary. */
  parents: string[];
  tournamentId: number;
  matchId: number | null;
};

type Crumb = { scope: "tournament" | "match"; id: number; label: string };
type Row = { id: number; label: string };

const keyOf = (scope: ProductionCreditScope, id: number) => `${scope}:${id}`;

/**
 * File tree like browser: each level lists checkable rows, the chevron opens a
 * row to list its children. Navigating never changes the selection, which is
 * kept (and summarised) across every level.
 */
export function ProductionTargetPicker({
  organizationId,
  value,
  onChange,
  error,
}: {
  organizationId: number;
  value: SelectedTarget[];
  onChange: (next: SelectedTarget[]) => void;
  error?: string;
}) {
  const t = useTranslations("dashboard.credits");
  const [path, setPath] = useState<Crumb[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const level: ProductionCreditScope = path.length === 0 ? "tournament" : path.length === 1 ? "match" : "map";
  const tournament = path[0];
  const match = path[1];
  const selectedKeys = new Set(value.map((v) => keyOf(v.scope, v.id)));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // The tournament level is searched server side, the match and map levels are filtered locally.
    const delay = level === "tournament" ? 250 : 0;
    const timeout = setTimeout(() => {
      const request: Promise<Row[]> =
        level === "tournament"
          ? searchTournamentsForCredit(organizationId, filter).then((r) => r.map((x) => ({ id: x.id, label: x.name })))
          : level === "match"
            ? getMatchOptionsForCredit(organizationId, tournament!.id)
            : getMapOptionsForCredit(organizationId, match!.id);
      request.then((result) => {
        if (cancelled) return;
        setRows(result);
        setLoading(false);
      });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [organizationId, level, tournament?.id, match?.id, level === "tournament" ? filter : ""]);

  function goTo(depth: number) {
    setPath((prev) => prev.slice(0, depth));
    setFilter("");
  }

  function open(row: Row) {
    setPath((prev) => [...prev, { scope: level as "tournament" | "match", id: row.id, label: row.label }]);
    setFilter("");
  }

  function toTarget(row: Row): SelectedTarget {
    if (level === "tournament") return { scope: "tournament", id: row.id, label: row.label, parents: [], tournamentId: row.id, matchId: null };
    if (level === "match") return { scope: "match", id: row.id, label: row.label, parents: [tournament!.label], tournamentId: tournament!.id, matchId: row.id };
    return { scope: "map", id: row.id, label: row.label, parents: [tournament!.label, match!.label], tournamentId: tournament!.id, matchId: match!.id };
  }

  function toggle(row: Row) {
    const key = keyOf(level, row.id);
    onChange(selectedKeys.has(key) ? value.filter((v) => keyOf(v.scope, v.id) !== key) : [...value, toTarget(row)]);
  }

  const visibleRows = level === "tournament" ? rows : rows.filter((r) => r.label.toLowerCase().includes(filter.trim().toLowerCase()));
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => selectedKeys.has(keyOf(level, r.id)));

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleKeys = new Set(visibleRows.map((r) => keyOf(level, r.id)));
      onChange(value.filter((v) => !visibleKeys.has(keyOf(v.scope, v.id))));
      return;
    }
    onChange([...value, ...visibleRows.filter((r) => !selectedKeys.has(keyOf(level, r.id))).map(toTarget)]);
  }

  /** Selected items nested under a row, to hint there is something picked inside before opening it. */
  function selectedInside(row: Row): number {
    if (level === "tournament") return value.filter((v) => v.tournamentId === row.id && v.scope !== "tournament").length;
    if (level === "match") return value.filter((v) => v.matchId === row.id && v.scope === "map").length;
    return 0;
  }

  const emptyLabel = level === "tournament" ? t("tournamentNoResults") : level === "match" ? t("matchEmpty") : t("mapEmpty");
  const searchPlaceholder = level === "tournament" ? t("tournamentSearchPlaceholder") : level === "match" ? t("matchSearchPlaceholder") : t("mapSearchPlaceholder");

  return (
    <div className="flex flex-col gap-3">
      <Label>
        {t("targetsLabel")}
        <RequiredMark />
      </Label>

      <div className={cn("flex flex-col gap-2 rounded-lg border p-2", error && "border-destructive")}>
        <nav aria-label={t("targetsLabel")} className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => goTo(0)}
            disabled={path.length === 0}
            className="rounded-md px-1.5 py-0.5 font-medium transition-colors hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:text-foreground"
          >
            {t("levelTournaments")}
          </button>
          {path.map((crumb, index) => (
            <span key={`${crumb.scope}:${crumb.id}`} className="flex min-w-0 items-center gap-1">
              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                disabled={index === path.length - 1}
                className="max-w-56 truncate rounded-md px-1.5 py-0.5 font-medium transition-colors hover:bg-accent active:scale-95 disabled:pointer-events-none"
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          {visibleRows.length > 0 && (
            <button
              type="button"
              onClick={toggleAllVisible}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
            >
              {allVisibleSelected ? t("deselectAll") : t("selectAll")}
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border">
          {path.length > 0 && (
            <button
              type="button"
              onClick={() => goTo(path.length - 1)}
              className="flex w-full items-center gap-2 border-b bg-muted/40 px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-accent active:bg-accent/70"
            >
              <ArrowLeftIcon className="size-4" />
              {t("goBack")}
            </button>
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              {t("loading")}
            </div>
          )}
          {!loading && visibleRows.length === 0 && <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>}
          {!loading &&
            visibleRows.map((row) => {
              const checked = selectedKeys.has(keyOf(level, row.id));
              const inside = selectedInside(row);
              return (
                <div key={row.id} className={cn("flex items-center border-b last:border-0", checked && "bg-primary/10")}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent/40 active:bg-accent/60">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(row)} />
                    <span className="truncate">{row.label}</span>
                    {inside > 0 && <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{t("selectedInside", { count: inside })}</span>}
                  </label>
                  {level !== "map" && (
                    <button
                      type="button"
                      onClick={() => open(row)}
                      aria-label={t("openLevel", { name: row.label })}
                      className="flex shrink-0 items-center gap-1.5 self-stretch border-l bg-muted/40 px-4 text-sm font-semibold transition-colors hover:bg-accent active:bg-accent/70"
                    >
                      {level === "tournament" ? t("openMatches") : t("openMaps")}
                      <ChevronRightIcon className="size-5" />
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <TargetSummary value={value} onChange={onChange} />
    </div>
  );
}

function TargetSummary({ value, onChange }: { value: SelectedTarget[]; onChange: (next: SelectedTarget[]) => void }) {
  const t = useTranslations("dashboard.credits");

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed bg-muted/30 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{t("summaryTitle", { count: value.length })}</p>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95">
            {t("clearSelection")}
          </button>
        )}
      </div>
      {value.length === 0 && <p className="text-sm text-muted-foreground">{t("summaryEmpty")}</p>}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={keyOf(v.scope, v.id)} className="flex max-w-full items-center gap-1 rounded-md border bg-background py-0.5 pr-0.5 pl-2 text-xs">
              <span className="shrink-0 font-semibold text-primary">{t(`level.${v.scope}`)}</span>
              <span className="flex min-w-0 items-center gap-0.5 truncate">
                {v.parents.map((p, i) => (
                  <span key={i} className="flex items-center gap-0.5 text-muted-foreground">
                    <span className="truncate">{p}</span>
                    <ChevronRightIcon className="size-3 shrink-0" />
                  </span>
                ))}
                <span className="truncate">{v.label}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => keyOf(x.scope, x.id) !== keyOf(v.scope, v.id)))}
                aria-label={t("removeTarget", { name: v.label })}
                className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-90"
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

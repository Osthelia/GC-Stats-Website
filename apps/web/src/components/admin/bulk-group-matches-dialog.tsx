/**
 * GC-Stats - bulk-group-matches-dialog
 *
 * Adds many matches to a round robin or Swiss group at once, all inheriting one round, best of and date.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { EntrantSelect } from "@/components/admin/entrant-select";
import { addGroupMatches, type AddGroupMatchFieldErrors, type AddGroupMatchesResult } from "@/actions/admin-bracket-editor";
import type { AdminContainerRow, AdminEntrantRow } from "@/lib/admin-tournament-detail";

type Row = { key: number; entrantAId: number | null; entrantBId: number | null };
type RowErrors = Extract<AddGroupMatchesResult, { ok: false }>["rowErrors"];

const INITIAL_ROWS = 4;

function blankRows(from: number, count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ key: from + i, entrantAId: null, entrantBId: null }));
}

export function BulkGroupMatchesDialog({
  stageId,
  container,
  entrants,
  open,
  onOpenChange,
}: {
  stageId: number;
  container: AdminContainerRow;
  entrants: AdminEntrantRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<AddGroupMatchFieldErrors>({});
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [round, setRound] = useState("1");
  const [bestOf, setBestOf] = useState("1");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [nextKey, setNextKey] = useState(0);

  useEffect(() => {
    if (open) {
      setRound("1");
      setBestOf("1");
      setScheduledAt(null);
      setRows(blankRows(0, INITIAL_ROWS));
      setNextKey(INITIAL_ROWS);
      setFieldErrors({});
      setRowErrors({});
    }
  }, [open]);

  function addRows(count: number) {
    setRows((prev) => [...prev, ...blankRows(nextKey, count)]);
    setNextKey((k) => k + count);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleSubmit(force = false) {
    setFieldErrors({});
    setRowErrors({});
    startTransition(async () => {
      const result = await addGroupMatches({
        stageId,
        containerId: container.id,
        round,
        bestOf,
        scheduledAt,
        force,
        matches: rows.map((r) => ({ entrantAId: r.entrantAId, entrantBId: r.entrantBId })),
      });
      if (!result.ok) {
        if (result.fieldErrors.container) toast.error(t(`error.${result.fieldErrors.container}`));
        setFieldErrors(result.fieldErrors);
        setRowErrors(result.rowErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("bulkMatchesSuccess", { count: result.count }));
    });
  }

  const err = (field: keyof AddGroupMatchFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  const recordMismatch = Object.values(rowErrors).some((e) => e.entrantBId === "recordMismatch");

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("bulkMatchesTitle", { name: container.name })}</DialogTitle>
          <DialogDescription>{t("bulkMatchesDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_8rem_1fr]">
            <FormField label={t("fieldMatchRound")} htmlFor="bm-round" required error={err("round")}>
              <Input id="bm-round" type="number" min={1} value={round} onChange={(e) => setRound(e.target.value)} aria-invalid={!!fieldErrors.round} />
            </FormField>
            <FormField label={t("fieldMatchBestOf")} htmlFor="bm-best-of" required error={err("bestOf")}>
              <Input id="bm-best-of" type="number" min={1} value={bestOf} onChange={(e) => setBestOf(e.target.value)} aria-invalid={!!fieldErrors.bestOf} />
            </FormField>
            <FormField label={t("fieldMatchScheduledAt")} htmlFor="bm-scheduled-at" error={err("scheduledAt")}>
              <DateTimeInput id="bm-scheduled-at" value={scheduledAt} onChange={setScheduledAt} aria-invalid={!!fieldErrors.scheduledAt} />
            </FormField>
          </div>

          <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
            {rows.map((row, index) => {
              const errs = rowErrors[index];
              const rowError = errs?.entrantAId ?? errs?.entrantBId;
              return (
                <div key={row.key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                    <EntrantSelect value={row.entrantAId} entrants={entrants} onChange={(id) => updateRow(row.key, { entrantAId: id })} invalid={!!errs?.entrantAId} />
                    <span className="text-xs text-muted-foreground">vs</span>
                    <EntrantSelect value={row.entrantBId} entrants={entrants} onChange={(id) => updateRow(row.key, { entrantBId: id })} invalid={!!errs?.entrantBId} />
                    <Button variant="ghost" size="icon" aria-label={t("bulkMatchesRemoveRow")} onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))} disabled={isPending}>
                      <Trash2Icon />
                    </Button>
                  </div>
                  {rowError && <p className="pl-8 text-xs text-destructive">{t(`error.${rowError}`)}</p>}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addRows(1)} disabled={isPending}>
              <PlusIcon />
              {t("bulkMatchesAddRow")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => addRows(5)} disabled={isPending}>
              <PlusIcon />
              {t("bulkMatchesAddFiveRows")}
            </Button>
          </div>

          {recordMismatch && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">{t("recordMismatchForceHint")}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          {recordMismatch && (
            <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={isPending}>
              {t("forceAdd")}
            </Button>
          )}
          <Button onClick={() => handleSubmit()} disabled={isPending || rows.length === 0}>
            {isPending ? t("saving") : t("bulkMatchesSubmit", { count: rows.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

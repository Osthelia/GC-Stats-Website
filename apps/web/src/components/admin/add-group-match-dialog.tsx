/**
 * GC-Stats - add-group-match-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { EntrantSelect } from "@/components/admin/entrant-select";
import { addGroupMatch, type AddGroupMatchFieldErrors } from "@/actions/admin-bracket-editor";
import type { AdminContainerRow, AdminEntrantRow } from "@/lib/admin-tournament-detail";
import { useGame } from "@/lib/use-game";

export function AddGroupMatchDialog({
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
  const game = useGame();
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<AddGroupMatchFieldErrors>({});
  const [round, setRound] = useState("1");
  const [bestOf, setBestOf] = useState("1");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [entrantAId, setEntrantAId] = useState<number | null>(null);
  const [entrantBId, setEntrantBId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setRound("1");
      setBestOf("1");
      setScheduledAt(null);
      setEntrantAId(null);
      setEntrantBId(null);
      setFieldErrors({});
    }
  }, [open]);

  function handleSubmit(force = false) {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addGroupMatch(game, { stageId, containerId: container.id, round, bestOf, scheduledAt, entrantAId, entrantBId, force });
      if (!result.ok) {
        if (result.fieldErrors.container) toast.error(t(`error.${result.fieldErrors.container}`));
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("addMatchSuccess"));
    });
  }

  const err = (field: keyof AddGroupMatchFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  const recordMismatch = fieldErrors.entrantBId === "recordMismatch";

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addMatchTitle", { name: container.name })}</DialogTitle>
          <DialogDescription>{t("addMatchDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldMatchRound")} htmlFor="gm-round" required error={err("round")}>
              <Input id="gm-round" type="number" min={1} value={round} onChange={(e) => setRound(e.target.value)} aria-invalid={!!fieldErrors.round} />
            </FormField>
            <FormField label={t("fieldMatchBestOf")} htmlFor="gm-best-of" required error={err("bestOf")}>
              <Input id="gm-best-of" type="number" min={1} value={bestOf} onChange={(e) => setBestOf(e.target.value)} aria-invalid={!!fieldErrors.bestOf} />
            </FormField>
          </div>
          <FormField label={t("fieldMatchScheduledAt")} htmlFor="gm-scheduled-at" error={err("scheduledAt")}>
            <DateTimeInput id="gm-scheduled-at" value={scheduledAt} onChange={setScheduledAt} aria-invalid={!!fieldErrors.scheduledAt} />
          </FormField>
          <FormField label={t("fieldMatchEntrantA")} htmlFor="gm-entrant-a" error={err("entrantAId")}>
            <EntrantSelect id="gm-entrant-a" value={entrantAId} entrants={entrants} onChange={setEntrantAId} invalid={!!fieldErrors.entrantAId} />
          </FormField>
          <FormField label={t("fieldMatchEntrantB")} htmlFor="gm-entrant-b" error={err("entrantBId")}>
            <EntrantSelect id="gm-entrant-b" value={entrantBId} entrants={entrants} onChange={setEntrantBId} invalid={!!fieldErrors.entrantBId} />
          </FormField>
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
          <Button onClick={() => handleSubmit()} disabled={isPending}>
            {isPending ? t("saving") : t("addMatchSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

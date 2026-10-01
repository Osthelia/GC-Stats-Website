/**
 * GC-Stats - stage-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { createStage, updateStage, type StageFieldErrors } from "@/actions/admin-stages";
import type { AdminStageRow } from "@/lib/admin-tournament-detail";

type FormState = { name: string; sequenceOrder: string; startDate: string; endDate: string; liquipediaLink: string };

export function StageDialog({
  tournamentId,
  stage,
  nextSequenceOrder,
  open,
  onOpenChange,
}: {
  tournamentId: number;
  stage: AdminStageRow | null;
  nextSequenceOrder: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<StageFieldErrors>({});
  const [form, setForm] = useState<FormState>({ name: "", sequenceOrder: String(nextSequenceOrder), startDate: "", endDate: "", liquipediaLink: "" });

  useEffect(() => {
    if (open) {
      setForm(
        stage
          ? { name: stage.name, sequenceOrder: String(stage.sequenceOrder), startDate: stage.startDate ?? "", endDate: stage.endDate ?? "", liquipediaLink: stage.liquipediaLink ?? "" }
          : { name: "", sequenceOrder: String(nextSequenceOrder), startDate: "", endDate: "", liquipediaLink: "" }
      );
      setFieldErrors({});
    }
  }, [open, stage, nextSequenceOrder]);

  function handleSubmit() {
    setFieldErrors({});
    const input = {
      name: form.name,
      sequenceOrder: Number(form.sequenceOrder),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      liquipediaLink: form.liquipediaLink,
    };
    startTransition(async () => {
      const result = stage ? await updateStage(stage.id, tournamentId, input) : await createStage(tournamentId, input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(stage ? t("updateSuccess") : t("addSuccess"));
    });
  }

  const err = (field: keyof StageFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stage ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{stage ? t("editDescription") : t("addDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("fieldName")} htmlFor="stg-name" required error={err("name")}>
            <Input id="stg-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} aria-invalid={!!fieldErrors.name} />
          </FormField>
          <FormField label={t("fieldSequenceOrder")} htmlFor="stg-order" required error={err("sequenceOrder")} hint={t("fieldSequenceOrderHint")}>
            <Input id="stg-order" type="number" min={1} value={form.sequenceOrder} onChange={(e) => setForm((p) => ({ ...p, sequenceOrder: e.target.value }))} aria-invalid={!!fieldErrors.sequenceOrder} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldStartDate")} htmlFor="stg-start-date" error={err("startDate")}>
              <Input id="stg-start-date" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} aria-invalid={!!fieldErrors.startDate} />
            </FormField>
            <FormField label={t("fieldEndDate")} htmlFor="stg-end-date" error={err("endDate")}>
              <Input id="stg-end-date" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} aria-invalid={!!fieldErrors.endDate} />
            </FormField>
          </div>
          <FormField label={t("fieldLiquipedia")} htmlFor="stg-liquipedia" error={err("liquipediaLink")}>
            <Input
              id="stg-liquipedia"
              type="url"
              value={form.liquipediaLink}
              placeholder="https://liquipedia.net/…"
              onChange={(e) => setForm((p) => ({ ...p, liquipediaLink: e.target.value }))}
              aria-invalid={!!fieldErrors.liquipediaLink}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

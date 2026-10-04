/**
 * GC-Stats - stage-pickem-dialog
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
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { updateStagePickemSettings, type StagePickemSettingsFieldErrors } from "@/actions/admin-pickem";
import type { AdminStageRow } from "@/lib/admin-tournament-detail";

export function StagePickemDialog({ stage, open, onOpenChange }: { stage: AdminStageRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.tournaments.stages.pickem");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<StagePickemSettingsFieldErrors>({});
  const [enabled, setEnabled] = useState(false);
  const [opensAt, setOpensAt] = useState<string | null>(null);

  useEffect(() => {
    if (open && stage) {
      setEnabled(stage.pickemEnabled);
      setOpensAt(stage.pickemOpensAt);
      setFieldErrors({});
    }
  }, [open, stage]);

  function handleSubmit() {
    if (!stage) return;
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateStagePickemSettings(stage.id, { enabled, opensAt });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  if (!stage) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { stageName: stage.name })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} />
            {t("fieldEnabled")}
          </label>

          {enabled && (
            <FormField label={t("fieldOpensAt")} htmlFor="stg-pickem-opens-at" required error={fieldErrors.opensAt ? t(`error.${fieldErrors.opensAt}`) : undefined} hint={t("fieldOpensAtHint")}>
              <DateTimeInput id="stg-pickem-opens-at" value={opensAt} onChange={setOpensAt} aria-invalid={!!fieldErrors.opensAt} />
            </FormField>
          )}
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

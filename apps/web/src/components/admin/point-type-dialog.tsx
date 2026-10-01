/**
 * GC-Stats - point-type-dialog
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
import { createPointType, updatePointType, type PointTypeFieldErrors } from "@/actions/admin-point-types";
import type { AdminPointTypeRow } from "@/lib/admin-point-types";

type FormState = { name: string; label: string; startDate: string; endDate: string };

function emptyState(): FormState {
  return { name: "", label: "", startDate: "", endDate: "" };
}

function stateFromPointType(pointType: AdminPointTypeRow): FormState {
  return { name: pointType.name, label: pointType.label, startDate: pointType.startDate.slice(0, 10), endDate: pointType.endDate.slice(0, 10) };
}

export function PointTypeDialog({ pointType, open, onOpenChange }: { pointType: AdminPointTypeRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.pointTypes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<PointTypeFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(pointType ? stateFromPointType(pointType) : emptyState());
      setFieldErrors({});
    }
  }, [open, pointType]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = pointType ? await updatePointType(pointType.id, form) : await createPointType(form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(pointType ? t("updateSuccess") : t("createSuccess"));
    });
  }

  const err = (field: keyof PointTypeFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pointType ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{pointType ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("fieldName")} htmlFor="pt-name" required error={err("name")} hint={t("fieldNameHint")}>
            <Input id="pt-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          <FormField label={t("fieldLabel")} htmlFor="pt-label" required error={err("label")}>
            <Input id="pt-label" value={form.label} onChange={(e) => set("label", e.target.value)} aria-invalid={!!fieldErrors.label} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldStartDate")} htmlFor="pt-start-date" required error={err("startDate")}>
              <Input id="pt-start-date" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} aria-invalid={!!fieldErrors.startDate} />
            </FormField>
            <FormField label={t("fieldEndDate")} htmlFor="pt-end-date" required error={err("endDate")}>
              <Input id="pt-end-date" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} aria-invalid={!!fieldErrors.endDate} />
            </FormField>
          </div>
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

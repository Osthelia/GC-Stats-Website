/**
 * GC-Stats - about-team-category-dialog
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
import { saveAboutTeamCategory, type CategoryFieldErrors } from "@/actions/admin-about-team";
import type { AboutTeamCategoryRow } from "@/lib/admin-about-team";

type FormState = { key: string; labelFr: string; labelEn: string; order: string };

function emptyState(): FormState {
  return { key: "", labelFr: "", labelEn: "", order: "0" };
}

function stateFromCategory(category: AboutTeamCategoryRow): FormState {
  return { key: category.key, labelFr: category.label.fr ?? "", labelEn: category.label.en ?? "", order: String(category.order) };
}

export function AboutTeamCategoryDialog({ category, open, onOpenChange }: { category: AboutTeamCategoryRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.about.team.categories");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CategoryFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(category ? stateFromCategory(category) : emptyState());
      setFieldErrors({});
    }
  }, [open, category]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveAboutTeamCategory({ ...form, isNew: category === null });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  const err = (field: keyof CategoryFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? t("editTitle", { key: category.key }) : t("createTitle")}</DialogTitle>
          <DialogDescription>{category ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {!category && (
            <FormField label={t("fieldKey")} htmlFor="atc-key" required error={err("key")} hint={t("fieldKeyHint")}>
              <Input id="atc-key" value={form.key} onChange={(e) => set("key", e.target.value)} aria-invalid={!!fieldErrors.key} />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldLabelFr")} htmlFor="atc-label-fr" required error={err("labelFr")}>
              <Input id="atc-label-fr" value={form.labelFr} onChange={(e) => set("labelFr", e.target.value)} aria-invalid={!!fieldErrors.labelFr} />
            </FormField>
            <FormField label={t("fieldLabelEn")} htmlFor="atc-label-en" required error={err("labelEn")}>
              <Input id="atc-label-en" value={form.labelEn} onChange={(e) => set("labelEn", e.target.value)} aria-invalid={!!fieldErrors.labelEn} />
            </FormField>
          </div>

          <FormField label={t("fieldOrder")} htmlFor="atc-order" error={err("order")}>
            <Input id="atc-order" type="number" min="0" value={form.order} onChange={(e) => set("order", e.target.value)} aria-invalid={!!fieldErrors.order} />
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

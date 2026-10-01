/**
 * GC-Stats - about-section-dialog
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { saveAboutSection, type SectionFieldErrors } from "@/actions/admin-about";
import type { AboutSectionRow } from "@/lib/admin-about";

type FormState = { key: string; titleFr: string; titleEn: string; contentFr: string; contentEn: string; order: string };

function emptyState(): FormState {
  return { key: "", titleFr: "", titleEn: "", contentFr: "", contentEn: "", order: "0" };
}

function stateFromSection(section: AboutSectionRow): FormState {
  return {
    key: section.key,
    titleFr: section.title.fr ?? "",
    titleEn: section.title.en ?? "",
    contentFr: section.content.fr ?? "",
    contentEn: section.content.en ?? "",
    order: String(section.order),
  };
}

export function AboutSectionDialog({ section, open, onOpenChange }: { section: AboutSectionRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.about.sections");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<SectionFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(section ? stateFromSection(section) : emptyState());
      setFieldErrors({});
    }
  }, [open, section]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveAboutSection({ ...form, isNew: section === null });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("saveSuccess"));
    });
  }

  const err = (field: keyof SectionFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{section ? t("editTitle", { key: section.key }) : t("createTitle")}</DialogTitle>
          <DialogDescription>{section ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {!section && (
            <FormField label={t("fieldKey")} htmlFor="as-key" required error={err("key")} hint={t("fieldKeyHint")}>
              <Input id="as-key" value={form.key} onChange={(e) => set("key", e.target.value)} aria-invalid={!!fieldErrors.key} />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldTitleFr")} htmlFor="as-title-fr" required error={err("titleFr")}>
              <Input id="as-title-fr" value={form.titleFr} onChange={(e) => set("titleFr", e.target.value)} aria-invalid={!!fieldErrors.titleFr} />
            </FormField>
            <FormField label={t("fieldTitleEn")} htmlFor="as-title-en" required error={err("titleEn")}>
              <Input id="as-title-en" value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} aria-invalid={!!fieldErrors.titleEn} />
            </FormField>
          </div>

          <FormField label={t("fieldContentFr")} htmlFor="as-content-fr" error={err("contentFr")}>
            <Textarea id="as-content-fr" rows={5} value={form.contentFr} onChange={(e) => set("contentFr", e.target.value)} aria-invalid={!!fieldErrors.contentFr} />
          </FormField>
          <FormField label={t("fieldContentEn")} htmlFor="as-content-en" error={err("contentEn")}>
            <Textarea id="as-content-en" rows={5} value={form.contentEn} onChange={(e) => set("contentEn", e.target.value)} aria-invalid={!!fieldErrors.contentEn} />
          </FormField>

          <FormField label={t("fieldOrder")} htmlFor="as-order" error={err("order")}>
            <Input id="as-order" type="number" min="0" value={form.order} onChange={(e) => set("order", e.target.value)} aria-invalid={!!fieldErrors.order} />
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

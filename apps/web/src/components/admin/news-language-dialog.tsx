/**
 * GC-Stats - news-language-dialog
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { createNewsLanguage, updateNewsLanguage, type NewsLanguageFieldErrors } from "@/actions/admin-news-languages";
import type { AdminNewsLanguageRow } from "@/lib/admin-news-languages";

type FormState = { code: string; name: string; sortOrder: string; isActive: boolean };

function emptyState(): FormState {
  return { code: "", name: "", sortOrder: "0", isActive: true };
}

function stateFromLanguage(language: AdminNewsLanguageRow): FormState {
  return { code: language.code, name: language.name, sortOrder: String(language.sortOrder), isActive: language.isActive };
}

export function NewsLanguageDialog({ language, open, onOpenChange }: { language: AdminNewsLanguageRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.newsLanguages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<NewsLanguageFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(language ? stateFromLanguage(language) : emptyState());
      setFieldErrors({});
    }
  }, [open, language]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    const input = { code: form.code, name: form.name, sortOrder: Number(form.sortOrder), isActive: form.isActive };
    startTransition(async () => {
      const result = language ? await updateNewsLanguage(language.code, input) : await createNewsLanguage(input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(language ? t("updateSuccess") : t("createSuccess"));
    });
  }

  const err = (field: keyof NewsLanguageFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{language ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("fieldCode")} htmlFor="nl-code" required error={err("code")} hint={language ? undefined : t("fieldCodeHint")}>
            <Input id="nl-code" value={form.code} onChange={(e) => set("code", e.target.value)} disabled={!!language} aria-invalid={!!fieldErrors.code} />
          </FormField>

          <FormField label={t("fieldName")} htmlFor="nl-name" required error={err("name")}>
            <Input id="nl-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          <div className="grid grid-cols-2 items-end gap-4">
            <FormField label={t("fieldSortOrder")} htmlFor="nl-sort-order" error={err("sortOrder")}>
              <Input id="nl-sort-order" type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} aria-invalid={!!fieldErrors.sortOrder} />
            </FormField>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={form.isActive} onCheckedChange={(checked) => set("isActive", checked === true)} />
              {t("fieldIsActive")}
            </label>
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

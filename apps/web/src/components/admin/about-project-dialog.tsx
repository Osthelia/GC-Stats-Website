/**
 * GC-Stats - about-project-dialog
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { createAboutProject, updateAboutProject, type ProjectFieldErrors } from "@/actions/admin-about";
import { ABOUT_PROJECT_TYPES } from "@/lib/about-project-types";
import type { AboutProjectRow } from "@/lib/admin-about";

type FormState = {
  name: string;
  type: string;
  descriptionFr: string;
  descriptionEn: string;
  url: string;
  logoUrl: string;
  order: string;
  isActive: boolean;
};

function emptyState(): FormState {
  return { name: "", type: ABOUT_PROJECT_TYPES[0], descriptionFr: "", descriptionEn: "", url: "", logoUrl: "", order: "0", isActive: true };
}

function stateFromProject(project: AboutProjectRow): FormState {
  return {
    name: project.name,
    type: project.type,
    descriptionFr: project.description.fr ?? "",
    descriptionEn: project.description.en ?? "",
    url: project.url ?? "",
    logoUrl: project.logoUrl ?? "",
    order: String(project.order),
    isActive: project.isActive,
  };
}

export function AboutProjectDialog({ project, open, onOpenChange }: { project: AboutProjectRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("admin.about.projects");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<ProjectFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(project ? stateFromProject(project) : emptyState());
      setFieldErrors({});
    }
  }, [open, project]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = project ? await updateAboutProject(project.id, form) : await createAboutProject(form);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(project ? t("updateSuccess") : t("createSuccess"));
    });
  }

  const err = (field: keyof ProjectFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);
  const typeItems = Object.fromEntries(ABOUT_PROJECT_TYPES.map((ty) => [ty, ty]));

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{project ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldName")} htmlFor="ap-name" required error={err("name")}>
              <Input id="ap-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
            </FormField>
            <FormField label={t("fieldType")} htmlFor="ap-type" required error={err("type")}>
              <Select items={typeItems} value={form.type} onValueChange={(v) => set("type", v ?? "")}>
                <SelectTrigger id="ap-type" className="w-full" aria-invalid={!!fieldErrors.type}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABOUT_PROJECT_TYPES.map((ty) => (
                    <SelectItem key={ty} value={ty}>
                      {ty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label={t("fieldDescriptionFr")} htmlFor="ap-desc-fr" error={err("descriptionFr")}>
            <Textarea id="ap-desc-fr" rows={3} value={form.descriptionFr} onChange={(e) => set("descriptionFr", e.target.value)} aria-invalid={!!fieldErrors.descriptionFr} />
          </FormField>
          <FormField label={t("fieldDescriptionEn")} htmlFor="ap-desc-en" error={err("descriptionEn")}>
            <Textarea id="ap-desc-en" rows={3} value={form.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} aria-invalid={!!fieldErrors.descriptionEn} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldUrl")} htmlFor="ap-url" error={err("url")}>
              <Input id="ap-url" type="url" value={form.url} onChange={(e) => set("url", e.target.value)} aria-invalid={!!fieldErrors.url} />
            </FormField>
            <FormField label={t("fieldLogoUrl")} htmlFor="ap-logo-url" error={err("logoUrl")} hint={t("fieldLogoUrlHint")}>
              <Input id="ap-logo-url" type="url" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} aria-invalid={!!fieldErrors.logoUrl} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 items-end gap-4">
            <FormField label={t("fieldOrder")} htmlFor="ap-order" error={err("order")}>
              <Input id="ap-order" type="number" min="0" value={form.order} onChange={(e) => set("order", e.target.value)} aria-invalid={!!fieldErrors.order} />
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

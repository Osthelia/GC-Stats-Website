/**
 * GC-Stats - create-organization-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { createOrganization, type CreateOrganizationFieldErrors } from "@/actions/admin-organizations";

export function CreateOrganizationDialog() {
  const t = useTranslations("admin.organizations");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CreateOrganizationFieldErrors>({});
  const [name, setName] = useState("");

  function reset() {
    setName("");
    setFieldErrors({});
  }

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createOrganization({ name });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
      toast.success(t("create.success", { name }), {
        action: { label: t("create.manage"), onClick: () => router.push(`/admin/organizations/${result.id}`) },
      });
    });
  }

  const err = (field: keyof CreateOrganizationFieldErrors) => (fieldErrors[field] ? t(`edit.error.${fieldErrors[field]}`) : undefined);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("create.button")}</Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>{t("create.description")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <FormField label={t("edit.fieldName")} htmlFor="create-organization-name" required error={err("name")}>
              <Input id="create-organization-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("create.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {t("create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

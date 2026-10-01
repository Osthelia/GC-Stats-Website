/**
 * GC-Stats - create-role-dialog
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
import { createRole } from "@/actions/admin-roles";

export function CreateRoleDialog() {
  const t = useTranslations("admin.roles");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createRole(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      router.push(`/admin/roles/${result.roleId}`);
      toast.success(t("create.success"));
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("create.button")}</Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setName("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>{t("create.description")}</DialogDescription>
          </DialogHeader>

          <FormField label={t("fieldName")} htmlFor="create-role-name" required error={error ? t(`error.${error}`) : undefined}>
            <Input
              id="create-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!error}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("create.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
              {t("create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

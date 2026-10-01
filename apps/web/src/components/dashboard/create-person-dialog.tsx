/**
 * GC-Stats - create-person-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { CountrySelect } from "@/components/admin/country-select";
import { createPersonForOrganization, type CreatePersonFieldErrors } from "@/actions/dashboard-organizations";

/** Dashboard sibling of admin's CreatePlayerDialog, trimmed to handle+country (no team assignment, gated by the separate peopleCreate permission). */
export function CreatePersonDialog({ organizationId, onCreated }: { organizationId: number; onCreated: (person: { id: number; handle: string }) => void }) {
  const t = useTranslations("dashboard.members");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CreatePersonFieldErrors>({});
  const [handle, setHandle] = useState("");
  const [countryCode, setCountryCode] = useState("");

  function reset() {
    setHandle("");
    setCountryCode("");
    setFieldErrors({});
  }

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createPersonForOrganization(organizationId, handle, countryCode);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      reset();
      toast.success(t("createPersonSuccess", { handle: result.handle }));
      onCreated({ id: result.id, handle: result.handle });
    });
  }

  const err = (field: keyof CreatePersonFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}` as "error.invalid") : undefined);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("createPersonButton")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createPersonTitle")}</DialogTitle>
            <DialogDescription>{t("createPersonDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <FormField label={t("createPersonHandleLabel")} htmlFor="create-person-handle" required error={err("handle")}>
              <Input id="create-person-handle" value={handle} onChange={(e) => setHandle(e.target.value)} aria-invalid={!!fieldErrors.handle} />
            </FormField>

            <FormField label={t("createPersonCountryLabel")} htmlFor="create-person-country" error={err("countryCode")}>
              <CountrySelect
                id="create-person-country"
                value={countryCode}
                onChange={setCountryCode}
                placeholder={t("createPersonCountryPlaceholder")}
                clearLabel={t("createPersonCountryClear")}
                invalid={!!fieldErrors.countryCode}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("createPersonCancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {t("createPersonSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

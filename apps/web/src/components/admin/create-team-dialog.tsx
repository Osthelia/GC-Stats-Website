/**
 * GC-Stats - create-team-dialog
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
import { CountrySelect } from "@/components/admin/country-select";
import { createTeam, type CreateTeamFieldErrors } from "@/actions/admin-teams";

export function CreateTeamDialog() {
  const t = useTranslations("admin.teams");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CreateTeamFieldErrors>({});

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [vlrId, setVlrId] = useState("");

  function reset() {
    setName("");
    setShortName("");
    setCountryCode("");
    setVlrId("");
    setFieldErrors({});
  }

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createTeam({ name, shortName, countryCode, vlrId });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
      toast.success(t("create.success", { name }), {
        action: { label: t("create.manage"), onClick: () => router.push(`/admin/teams/${result.id}`) },
      });
    });
  }

  const err = (field: keyof CreateTeamFieldErrors) => (fieldErrors[field] ? t(`edit.error.${fieldErrors[field]}`) : undefined);

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
            <FormField label={t("edit.fieldName")} htmlFor="create-team-name" required error={err("name")}>
              <Input id="create-team-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} />
            </FormField>

            <FormField label={t("edit.fieldShortName")} htmlFor="create-team-short-name" error={err("shortName")}>
              <Input id="create-team-short-name" value={shortName} onChange={(e) => setShortName(e.target.value)} aria-invalid={!!fieldErrors.shortName} />
            </FormField>

            <FormField label={t("edit.fieldCountry")} htmlFor="create-team-country" error={err("countryCode")}>
              <CountrySelect
                id="create-team-country"
                value={countryCode}
                onChange={setCountryCode}
                placeholder={t("edit.fieldCountryPlaceholder")}
                clearLabel={t("edit.fieldCountryClear")}
                invalid={!!fieldErrors.countryCode}
              />
            </FormField>

            <FormField label={t("edit.fieldVlrId")} htmlFor="create-team-vlr-id" error={err("vlrId")}>
              <Input id="create-team-vlr-id" inputMode="numeric" value={vlrId} onChange={(e) => setVlrId(e.target.value)} aria-invalid={!!fieldErrors.vlrId} />
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

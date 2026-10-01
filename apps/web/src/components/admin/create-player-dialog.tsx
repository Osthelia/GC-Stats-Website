/**
 * GC-Stats - create-player-dialog
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { CountrySelect } from "@/components/admin/country-select";
import { TeamPicker } from "@/components/admin/team-picker";
import { createPlayer, type CreatePlayerFieldErrors } from "@/actions/admin-players";

export function CreatePlayerDialog() {
  const t = useTranslations("admin.players");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CreatePlayerFieldErrors>({});

  const [handle, setHandle] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [vlrId, setVlrId] = useState("");
  const [team, setTeam] = useState<{ id: number; name: string } | null>(null);

  function reset() {
    setHandle("");
    setCountryCode("");
    setVlrId("");
    setTeam(null);
    setFieldErrors({});
  }

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createPlayer({ handle, countryCode, vlrId, teamId: team ? String(team.id) : "" });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
      toast.success(t("create.success", { handle }), {
        action: { label: t("create.manage"), onClick: () => router.push(`/admin/players/${result.id}`) },
      });
    });
  }

  const err = (field: keyof CreatePlayerFieldErrors) => (fieldErrors[field] ? t(`edit.error.${fieldErrors[field]}`) : undefined);

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
            <FormField label={t("edit.fieldHandle")} htmlFor="create-player-handle" required error={err("handle")}>
              <Input id="create-player-handle" value={handle} onChange={(e) => setHandle(e.target.value)} aria-invalid={!!fieldErrors.handle} />
            </FormField>

            <FormField label={t("edit.fieldCountry")} htmlFor="create-player-country" error={err("countryCode")}>
              <CountrySelect
                id="create-player-country"
                value={countryCode}
                onChange={setCountryCode}
                placeholder={t("edit.fieldCountryPlaceholder")}
                clearLabel={t("edit.fieldCountryClear")}
                invalid={!!fieldErrors.countryCode}
              />
            </FormField>

            <FormField label={t("edit.fieldVlrId")} htmlFor="create-player-vlr-id" error={err("vlrId")}>
              <Input id="create-player-vlr-id" inputMode="numeric" value={vlrId} onChange={(e) => setVlrId(e.target.value)} aria-invalid={!!fieldErrors.vlrId} />
            </FormField>

            <FormField label={t("edit.fieldTeam")} htmlFor="create-player-team" error={err("teamId")}>
              <TeamPicker
                value={team}
                onChange={setTeam}
                placeholder={t("edit.historyAddTeamPlaceholder")}
                searchPlaceholder={t("create.teamSearchPlaceholder")}
                noResultsLabel={t("create.teamNoResults")}
              />
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

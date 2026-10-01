/**
 * GC-Stats - entrant-dialog
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { TeamPicker } from "@/components/admin/team-picker";
import { addEntrant, updateEntrant, type EntrantFieldErrors, type EntrantInput } from "@/actions/admin-tournament-entrants";
import type { AdminEntrantRow } from "@/lib/admin-tournament-detail";

type FormState = { kind: "team" | "placeholder"; team: { id: number; name: string } | null; displayName: string; seed: string };

function emptyState(): FormState {
  return { kind: "team", team: null, displayName: "", seed: "" };
}

function stateFromEntrant(entrant: AdminEntrantRow): FormState {
  return {
    kind: entrant.kind === "team" ? "team" : "placeholder",
    team: entrant.teamId ? { id: entrant.teamId, name: entrant.displayName } : null,
    displayName: entrant.displayName,
    seed: entrant.seed !== null ? String(entrant.seed) : "",
  };
}

export function EntrantDialog({
  tournamentId,
  entrant,
  open,
  onOpenChange,
}: {
  tournamentId: number;
  entrant: AdminEntrantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.entrants");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<EntrantFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(entrant ? stateFromEntrant(entrant) : emptyState());
      setFieldErrors({});
    }
  }, [open, entrant]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    const input: EntrantInput = {
      kind: form.kind,
      teamId: form.kind === "team" ? (form.team?.id ?? null) : null,
      displayName: form.kind === "team" ? (form.team?.name ?? "") : form.displayName,
      seed: form.seed.trim() === "" ? null : Number(form.seed),
    };
    startTransition(async () => {
      const result = entrant ? await updateEntrant(entrant.id, tournamentId, input) : await addEntrant(tournamentId, input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(entrant ? t("updateSuccess") : t("addSuccess"));
    });
  }

  const err = (field: keyof EntrantFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entrant ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{entrant ? t("editDescription") : t("addDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <FormField label={t("fieldKind")} htmlFor="en-kind" required error={err("kind")}>
            <Select items={{ team: t("kindTeam"), placeholder: t("kindPlaceholder") }} value={form.kind} onValueChange={(v) => set("kind", v as "team" | "placeholder")}>
              <SelectTrigger id="en-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">{t("kindTeam")}</SelectItem>
                <SelectItem value="placeholder">{t("kindPlaceholder")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {form.kind === "team" ? (
            <FormField label={t("fieldTeam")} htmlFor="en-team" required error={err("teamId")}>
              <TeamPicker value={form.team} onChange={(team) => set("team", team)} placeholder={t("fieldTeamPlaceholder")} searchPlaceholder={t("fieldTeamSearchPlaceholder")} noResultsLabel={t("fieldTeamNoResults")} />
            </FormField>
          ) : (
            <FormField label={t("fieldDisplayName")} htmlFor="en-display-name" required error={err("displayName")}>
              <Input id="en-display-name" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} aria-invalid={!!fieldErrors.displayName} />
            </FormField>
          )}

          <FormField label={t("fieldSeed")} htmlFor="en-seed" error={err("seed")} hint={t("fieldSeedHint")}>
            <Input id="en-seed" type="number" min={1} value={form.seed} onChange={(e) => set("seed", e.target.value)} aria-invalid={!!fieldErrors.seed} />
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

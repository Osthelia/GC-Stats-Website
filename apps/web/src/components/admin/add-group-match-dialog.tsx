/**
 * GC-Stats - add-group-match-dialog
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
import { addGroupMatch, type AddGroupMatchFieldErrors } from "@/actions/admin-bracket-editor";
import type { AdminContainerRow, AdminEntrantRow } from "@/lib/admin-tournament-detail";

const ENTRANT_TBD = "tbd";

export function AddGroupMatchDialog({
  stageId,
  container,
  entrants,
  open,
  onOpenChange,
}: {
  stageId: number;
  container: AdminContainerRow;
  entrants: AdminEntrantRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<AddGroupMatchFieldErrors>({});
  const [round, setRound] = useState("1");
  const [bestOf, setBestOf] = useState("1");
  const [entrantAId, setEntrantAId] = useState(ENTRANT_TBD);
  const [entrantBId, setEntrantBId] = useState(ENTRANT_TBD);

  useEffect(() => {
    if (open) {
      setRound("1");
      setBestOf("1");
      setEntrantAId(ENTRANT_TBD);
      setEntrantBId(ENTRANT_TBD);
      setFieldErrors({});
    }
  }, [open]);

  // Restricted to the group's entrants once some are assigned (Swiss), otherwise every tournament entrant.
  const options = container.groupEntryEntrantIds.length > 0 ? entrants.filter((e) => container.groupEntryEntrantIds.includes(e.id)) : entrants;
  const entrantItems: Record<string, string> = { [ENTRANT_TBD]: t("addMatchEntrantTbd"), ...Object.fromEntries(options.map((e) => [String(e.id), e.displayName])) };

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await addGroupMatch({
        stageId,
        containerId: container.id,
        round,
        bestOf,
        entrantAId: entrantAId === ENTRANT_TBD ? null : Number(entrantAId),
        entrantBId: entrantBId === ENTRANT_TBD ? null : Number(entrantBId),
      });
      if (!result.ok) {
        if (result.fieldErrors.container) toast.error(t(`error.${result.fieldErrors.container}`));
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("addMatchSuccess"));
    });
  }

  const err = (field: keyof AddGroupMatchFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  function entrantSelect(id: string, value: string, onChange: (v: string) => void, invalid: boolean) {
    return (
      <Select items={entrantItems} value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ENTRANT_TBD}>{t("addMatchEntrantTbd")}</SelectItem>
          {options.map((e) => (
            <SelectItem key={e.id} value={String(e.id)}>
              {e.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addMatchTitle", { name: container.name })}</DialogTitle>
          <DialogDescription>{t("addMatchDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("fieldMatchRound")} htmlFor="gm-round" required error={err("round")}>
              <Input id="gm-round" type="number" min={1} value={round} onChange={(e) => setRound(e.target.value)} aria-invalid={!!fieldErrors.round} />
            </FormField>
            <FormField label={t("fieldMatchBestOf")} htmlFor="gm-best-of" required error={err("bestOf")}>
              <Input id="gm-best-of" type="number" min={1} value={bestOf} onChange={(e) => setBestOf(e.target.value)} aria-invalid={!!fieldErrors.bestOf} />
            </FormField>
          </div>
          <FormField label={t("fieldMatchEntrantA")} htmlFor="gm-entrant-a" error={err("entrantAId")}>
            {entrantSelect("gm-entrant-a", entrantAId, setEntrantAId, !!fieldErrors.entrantAId)}
          </FormField>
          <FormField label={t("fieldMatchEntrantB")} htmlFor="gm-entrant-b" error={err("entrantBId")}>
            {entrantSelect("gm-entrant-b", entrantBId, setEntrantBId, !!fieldErrors.entrantBId)}
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : t("addMatchSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

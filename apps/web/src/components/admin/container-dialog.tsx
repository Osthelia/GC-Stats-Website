/**
 * GC-Stats - container-dialog
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
import { createContainer, updateContainer, type ContainerFieldErrors, type ContainerInput, type PointsInput } from "@/actions/admin-containers";
import { parseGroupConfig } from "@/lib/bracket/config-types";
import type { AdminContainerRow } from "@/lib/admin-tournament-detail";

type ContainerType = "bracket" | "group";
type GroupFormat = "swiss" | "round_robin";

type FormState = {
  name: string;
  containerType: ContainerType;
  groupFormat: GroupFormat;
  qualifyAtWins: string;
  eliminateAtLosses: string;
  maxRounds: string;
  matchWinPoints: string;
  mapWinPoints: string;
  roundWinPoints: string;
  matchForfeitWinPoints: string;
  mapForfeitWinPoints: string;
};

function emptyState(): FormState {
  return {
    name: "",
    containerType: "bracket",
    groupFormat: "swiss",
    qualifyAtWins: "3",
    eliminateAtLosses: "3",
    maxRounds: "5",
    matchWinPoints: "",
    mapWinPoints: "",
    roundWinPoints: "",
    matchForfeitWinPoints: "",
    mapForfeitWinPoints: "",
  };
}

function stateFromContainer(container: AdminContainerRow): FormState {
  const base = emptyState();
  base.name = container.name;
  base.containerType = container.containerType;
  if (container.containerType !== "group") return base;

  const config = parseGroupConfig(container.config);
  base.groupFormat = config.type;
  if (config.type === "swiss") {
    base.qualifyAtWins = config.qualifyAtWins !== null ? String(config.qualifyAtWins) : "";
    base.eliminateAtLosses = config.eliminateAtLosses !== null ? String(config.eliminateAtLosses) : "";
    base.maxRounds = String(config.maxRounds);
  }
  const points = config.pointsConfig;
  base.matchWinPoints = points?.matchWin !== null && points?.matchWin !== undefined ? String(points.matchWin) : "";
  base.mapWinPoints = points?.mapWin !== null && points?.mapWin !== undefined ? String(points.mapWin) : "";
  base.roundWinPoints = points?.roundWin !== null && points?.roundWin !== undefined ? String(points.roundWin) : "";
  base.matchForfeitWinPoints = points?.matchForfeitWin !== null && points?.matchForfeitWin !== undefined ? String(points.matchForfeitWin) : "";
  base.mapForfeitWinPoints = points?.mapForfeitWin !== null && points?.mapForfeitWin !== undefined ? String(points.mapForfeitWin) : "";
  return base;
}

const POINTS_FIELDS: { key: keyof FormState & keyof PointsInput; labelKey: string; hintKey: string }[] = [
  { key: "matchWinPoints", labelKey: "fieldMatchWinPoints", hintKey: "fieldMatchWinPointsHint" },
  { key: "mapWinPoints", labelKey: "fieldMapWinPoints", hintKey: "fieldMapWinPointsHint" },
  { key: "roundWinPoints", labelKey: "fieldRoundWinPoints", hintKey: "fieldRoundWinPointsHint" },
  { key: "matchForfeitWinPoints", labelKey: "fieldMatchForfeitWinPoints", hintKey: "fieldMatchForfeitWinPointsHint" },
  { key: "mapForfeitWinPoints", labelKey: "fieldMapForfeitWinPoints", hintKey: "fieldMapForfeitWinPointsHint" },
];

export function ContainerDialog({
  stageId,
  container,
  open,
  onOpenChange,
}: {
  stageId: number;
  container?: AdminContainerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<ContainerFieldErrors>({});
  const [form, setForm] = useState<FormState>(emptyState());

  useEffect(() => {
    if (open) {
      setForm(container ? stateFromContainer(container) : emptyState());
      setFieldErrors({});
    }
  }, [open, container]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    const points: PointsInput = {
      matchWinPoints: form.matchWinPoints.trim() === "" ? null : Number(form.matchWinPoints),
      mapWinPoints: form.mapWinPoints.trim() === "" ? null : Number(form.mapWinPoints),
      roundWinPoints: form.roundWinPoints.trim() === "" ? null : Number(form.roundWinPoints),
      matchForfeitWinPoints: form.matchForfeitWinPoints.trim() === "" ? null : Number(form.matchForfeitWinPoints),
      mapForfeitWinPoints: form.mapForfeitWinPoints.trim() === "" ? null : Number(form.mapForfeitWinPoints),
    };
    const input: ContainerInput =
      form.containerType === "bracket"
        ? { name: form.name, containerType: "bracket" }
        : {
            name: form.name,
            containerType: "group",
            groupFormat: form.groupFormat,
            qualifyAtWins: form.groupFormat === "swiss" && form.qualifyAtWins.trim() !== "" ? Number(form.qualifyAtWins) : null,
            eliminateAtLosses: form.groupFormat === "swiss" && form.eliminateAtLosses.trim() !== "" ? Number(form.eliminateAtLosses) : null,
            maxRounds: form.groupFormat === "swiss" ? Number(form.maxRounds) : null,
            ...points,
          };
    startTransition(async () => {
      const result = container ? await updateContainer(container.id, stageId, input) : await createContainer(stageId, input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(container ? t("containerUpdateSuccess") : t("containerAddSuccess"));
    });
  }

  const err = (field: keyof ContainerFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{container ? t("containerEditTitle") : t("containerAddTitle")}</DialogTitle>
          <DialogDescription>{container ? t("containerEditDescription") : t("containerAddDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
          <FormField label={t("fieldContainerName")} htmlFor="ctr-name" required error={err("name")}>
            <Input id="ctr-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          <FormField label={t("fieldContainerType")} htmlFor="ctr-type" required hint={container ? t("fieldContainerTypeChangeHint") : undefined}>
            <Select items={{ bracket: t("containerTypeBracket"), group: t("containerTypeGroup") }} value={form.containerType} onValueChange={(v) => set("containerType", v as ContainerType)}>
              <SelectTrigger id="ctr-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bracket">{t("containerTypeBracket")}</SelectItem>
                <SelectItem value="group">{t("containerTypeGroup")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {form.containerType === "group" && (
            <>
              <FormField label={t("fieldGroupFormat")} htmlFor="ctr-group-format" required>
                <Select items={{ swiss: t("groupFormatSwiss"), round_robin: t("groupFormatRoundRobin") }} value={form.groupFormat} onValueChange={(v) => set("groupFormat", v as GroupFormat)}>
                  <SelectTrigger id="ctr-group-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swiss">{t("groupFormatSwiss")}</SelectItem>
                    <SelectItem value="round_robin">{t("groupFormatRoundRobin")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {form.groupFormat === "swiss" && (
                <div className="grid grid-cols-3 gap-4">
                  <FormField label={t("fieldQualifyAtWins")} htmlFor="ctr-qualify" error={err("qualifyAtWins")} hint={t("fieldQualifyAtWinsHint")}>
                    <Input id="ctr-qualify" type="number" min={1} value={form.qualifyAtWins} onChange={(e) => set("qualifyAtWins", e.target.value)} aria-invalid={!!fieldErrors.qualifyAtWins} />
                  </FormField>
                  <FormField label={t("fieldEliminateAtLosses")} htmlFor="ctr-eliminate" error={err("eliminateAtLosses")} hint={t("fieldEliminateAtLossesHint")}>
                    <Input id="ctr-eliminate" type="number" min={1} value={form.eliminateAtLosses} onChange={(e) => set("eliminateAtLosses", e.target.value)} aria-invalid={!!fieldErrors.eliminateAtLosses} />
                  </FormField>
                  <FormField label={t("fieldMaxRounds")} htmlFor="ctr-max-rounds" required error={err("maxRounds")}>
                    <Input id="ctr-max-rounds" type="number" min={1} value={form.maxRounds} onChange={(e) => set("maxRounds", e.target.value)} aria-invalid={!!fieldErrors.maxRounds} />
                  </FormField>
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{t("pointsSectionTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("pointsSectionHint")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {POINTS_FIELDS.map(({ key, labelKey, hintKey }) => (
                    <FormField key={key} label={t(labelKey)} htmlFor={`ctr-${key}`} error={err(key)} hint={t(hintKey)}>
                      <Input id={`ctr-${key}`} type="number" step="any" value={form[key]} onChange={(e) => set(key, e.target.value)} aria-invalid={!!fieldErrors[key]} />
                    </FormField>
                  ))}
                </div>
              </div>
            </>
          )}
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

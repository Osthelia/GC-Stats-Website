/**
 * GC-Stats - container-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/admin/form-field";
import { RequiredMark } from "@/components/admin/required-mark";
import { StageStatusSelect } from "@/components/admin/stage-status-select";
import { TiebreakerOrder } from "@/components/admin/tiebreaker-order";
import { createContainer, updateContainer, moveContainerToSet, type ContainerFieldErrors, type ContainerInput } from "@/actions/admin-containers";
import { EMPTY_POINTS, POINTS_FIELDS, ROUND_ROBIN_TIEBREAKERS, SWISS_TIEBREAKERS, parseGroupConfig, type PointsField } from "@/lib/bracket/config-types";
import type { AdminContainerRow } from "@/lib/admin-tournament-detail";
import type { StageStatus } from "@/lib/stage-status";

type ContainerType = "bracket" | "group";
type GroupFormat = "swiss" | "round_robin";

// Select value standing for "no set", a container at the root of its stage
const ROOT_VALUE = "root";

export type SetOption = { id: number; label: string };

type FormState = {
  name: string;
  parentId: string;
  status: StageStatus;
  containerType: ContainerType;
  groupFormat: GroupFormat;
  qualifyAtWins: string;
  eliminateAtLosses: string;
  maxRounds: string;
  tiebreakers: string[];
  pointsOn: boolean;
  points: Record<PointsField, string>;
};

const DEFAULT_TIEBREAKERS: Record<GroupFormat, string[]> = { swiss: ["buchholz", "round_diff", "seed"], round_robin: ["round_diff", "head_to_head", "seed"] };

const pointsState = (values: Record<PointsField, number>) => Object.fromEntries(POINTS_FIELDS.map((f) => [f, String(values[f])])) as Record<PointsField, string>;

function emptyState(parentId: number | null = null): FormState {
  return {
    name: "",
    parentId: parentId === null ? ROOT_VALUE : String(parentId),
    status: "pending",
    containerType: "bracket",
    groupFormat: "swiss",
    qualifyAtWins: "3",
    eliminateAtLosses: "3",
    maxRounds: "5",
    tiebreakers: DEFAULT_TIEBREAKERS.swiss,
    pointsOn: false,
    points: pointsState(EMPTY_POINTS),
  };
}

function stateFromContainer(container: AdminContainerRow): FormState {
  const base = emptyState();
  base.name = container.name;
  base.parentId = container.parentId === null ? ROOT_VALUE : String(container.parentId);
  base.status = container.status;
  base.containerType = container.containerType === "group" ? "group" : "bracket";
  if (container.containerType !== "group") return base;

  const config = parseGroupConfig(container.config);
  base.groupFormat = config.type;
  if (config.type === "swiss") {
    base.qualifyAtWins = config.qualifyAtWins !== null ? String(config.qualifyAtWins) : "";
    base.eliminateAtLosses = config.eliminateAtLosses !== null ? String(config.eliminateAtLosses) : "";
    base.maxRounds = String(config.maxRounds);
  }
  base.tiebreakers = [...config.tiebreakers];
  base.pointsOn = config.pointsConfig !== null;
  base.points = pointsState(config.pointsConfig ?? EMPTY_POINTS);
  return base;
}

export function ContainerDialog({
  stageId,
  container,
  sets = [],
  defaultParentId = null,
  open,
  onOpenChange,
}: {
  stageId: number;
  container?: AdminContainerRow | null;
  /** Sets of the stage a container can be put in. */
  sets?: SetOption[];
  /** Set preselected when adding a container. */
  defaultParentId?: number | null;
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
      setForm(container ? stateFromContainer(container) : emptyState(defaultParentId));
      setFieldErrors({});
    }
  }, [open, container, defaultParentId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit() {
    setFieldErrors({});
    // An empty value is sent as null so the server can say it is required
    const pointsConfig = form.pointsOn
      ? (Object.fromEntries(POINTS_FIELDS.map((f) => [f, form.points[f].trim() === "" ? null : Number(form.points[f])])) as Record<PointsField, number | null>)
      : null;
    const parentId = form.parentId === ROOT_VALUE ? null : Number(form.parentId);
    const input: ContainerInput =
      form.containerType === "bracket"
        ? { name: form.name, status: form.status, containerType: "bracket", parentId }
        : {
            name: form.name,
            status: form.status,
            containerType: "group",
            parentId,
            groupFormat: form.groupFormat,
            qualifyAtWins: form.groupFormat === "swiss" && form.qualifyAtWins.trim() !== "" ? Number(form.qualifyAtWins) : null,
            eliminateAtLosses: form.groupFormat === "swiss" && form.eliminateAtLosses.trim() !== "" ? Number(form.eliminateAtLosses) : null,
            maxRounds: form.groupFormat === "swiss" ? Number(form.maxRounds) : null,
            tiebreakers: form.tiebreakers,
            pointsConfig,
          };
    startTransition(async () => {
      const result = container ? await updateContainer(container.id, stageId, input) : await createContainer(stageId, input);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      if (container && parentId !== container.parentId) {
        const moved = await moveContainerToSet(container.id, stageId, parentId);
        if (!moved.ok) {
          setFieldErrors({ parentId: moved.error === "parentInvalid" ? "parentInvalid" : "invalid" });
          return;
        }
      }
      onOpenChange(false);
      router.refresh();
      toast.success(container ? t("containerUpdateSuccess") : t("containerAddSuccess"));
    });
  }

  const err = (field: keyof ContainerFieldErrors) => (fieldErrors[field] ? t(`error.${fieldErrors[field]}`) : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{container ? t("containerEditTitle") : t("containerAddTitle")}</DialogTitle>
          <DialogDescription>{container ? t("containerEditDescription") : t("containerAddDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-2">
          <FormField label={t("fieldContainerName")} htmlFor="ctr-name" required error={err("name")}>
            <Input id="ctr-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!fieldErrors.name} />
          </FormField>

          {sets.length > 0 && (
            <FormField label={t("fieldParentSet")} htmlFor="ctr-parent" error={err("parentId")} hint={t("fieldParentSetHint")}>
              <Select
                items={{ [ROOT_VALUE]: t("parentSetNone"), ...Object.fromEntries(sets.map((s) => [String(s.id), s.label])) }}
                value={form.parentId}
                onValueChange={(v) => set("parentId", String(v))}
              >
                <SelectTrigger id="ctr-parent" className="w-full" aria-invalid={!!fieldErrors.parentId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_VALUE}>{t("parentSetNone")}</SelectItem>
                  {sets.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField label={t("fieldStatus")} htmlFor="ctr-status" required error={err("status")} hint={t("fieldStatusHint")}>
            <StageStatusSelect id="ctr-status" value={form.status} onChange={(status) => set("status", status)} invalid={!!fieldErrors.status} />
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
                <Select items={{ swiss: t("groupFormatSwiss"), round_robin: t("groupFormatRoundRobin") }} value={form.groupFormat} onValueChange={(v) => setForm((prev) => (prev.groupFormat === v ? prev : { ...prev, groupFormat: v as GroupFormat, tiebreakers: DEFAULT_TIEBREAKERS[v as GroupFormat] }))}>
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

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  {t("tiebreakerOrder.title")}
                  <RequiredMark />
                </p>
                <p className="text-xs text-muted-foreground">{t("tiebreakerOrder.hint")}</p>
                <TiebreakerOrder value={form.tiebreakers} options={form.groupFormat === "swiss" ? SWISS_TIEBREAKERS : ROUND_ROBIN_TIEBREAKERS} onChange={(next) => set("tiebreakers", next)} />
                {fieldErrors.tiebreakers && (
                  <p role="alert" className="text-sm text-destructive">
                    {err("tiebreakers")}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{t("pointsConfig.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("pointsConfig.hint")}</p>
                </div>
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={form.pointsOn} onCheckedChange={(checked) => set("pointsOn", checked === true)} />
                  {t("pointsConfig.enable")}
                </label>
                {form.pointsOn && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["match", "map", "round", "forfeit"] as const).map((scope) => (
                      <div key={scope} className="flex flex-col gap-2 rounded-md border p-2.5">
                        <p className="text-xs font-semibold text-muted-foreground">{t(`pointsConfig.scopes.${scope}`)}</p>
                        <div className="flex gap-2">
                          {(["Win", "Loss"] as const).map((side) => {
                            const field = `${scope}${side}` as PointsField;
                            return (
                              <FormField key={field} className="flex-1" label={t(side === "Win" ? "pointsConfig.win" : "pointsConfig.loss")} htmlFor={`ctr-points-${field}`} required error={err(`points.${field}`)}>
                                <Input
                                  id={`ctr-points-${field}`}
                                  type="number"
                                  step={1}
                                  value={form.points[field]}
                                  onChange={(e) => setForm((prev) => ({ ...prev, points: { ...prev.points, [field]: e.target.value } }))}
                                  aria-invalid={!!fieldErrors[`points.${field}`]}
                                />
                              </FormField>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {form.pointsOn && !form.tiebreakers.includes("points") && <p className="text-xs text-muted-foreground">{t("pointsConfig.notUsed")}</p>}
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

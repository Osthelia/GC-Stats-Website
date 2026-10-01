/**
 * GC-Stats - group-scoring-panel
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import { setGroupScoringMode, setGroupPhasePoints, type GroupPhasePointsInput, type GroupPhasePointsFieldErrors } from "@/actions/pickem";
import type { PhaseScoringConfig } from "@/lib/pickem/scoring";

type StagePhase = { id: number; name: string };

export function GroupScoringPanel({
  groupId,
  scoringMode,
  stages,
  configByStageId,
}: {
  groupId: number;
  scoringMode: "default" | "custom";
  stages: StagePhase[];
  configByStageId: Record<number, PhaseScoringConfig>;
}) {
  const t = useTranslations("pickemPage.groups.scoring");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStageId, setSelectedStageId] = useState<number | null>(stages[0]?.id ?? null);
  const config = selectedStageId !== null ? configByStageId[selectedStageId] : undefined;
  const [form, setForm] = useState<GroupPhasePointsInput | null>(config ?? null);
  const [fieldErrors, setFieldErrors] = useState<GroupPhasePointsFieldErrors>({});

  function handleModeChange(mode: "default" | "custom") {
    startTransition(async () => {
      const result = await setGroupScoringMode(groupId, mode);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("modeSaveSuccess"));
    });
  }

  function selectStage(stageId: number) {
    setSelectedStageId(stageId);
    setForm(configByStageId[stageId] ?? null);
    setFieldErrors({});
  }

  function handleSavePoints() {
    if (selectedStageId === null || !form) return;
    setFieldErrors({});
    startTransition(async () => {
      const result = await setGroupPhasePoints(groupId, selectedStageId, form);
      if (!result.ok) {
        if ("fieldErrors" in result) setFieldErrors(result.fieldErrors);
        else toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("pointsSaveSuccess"));
    });
  }

  const modeItems: Record<string, string> = { default: t("modeDefault"), custom: t("modeCustom") };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormField label={t("fieldMode")} htmlFor="pickem-scoring-mode">
          <Select items={modeItems} value={scoringMode} onValueChange={(v) => v && handleModeChange(v as "default" | "custom")}>
            <SelectTrigger id="pickem-scoring-mode" disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(modeItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {scoringMode === "custom" && stages.length > 0 && (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <FormField label={t("fieldStage")} htmlFor="pickem-scoring-stage">
              <Select
                items={Object.fromEntries(stages.map((s) => [String(s.id), s.name]))}
                value={selectedStageId !== null ? String(selectedStageId) : ""}
                onValueChange={(v) => v && selectStage(Number(v))}
              >
                <SelectTrigger id="pickem-scoring-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {form && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("fieldTeamCorrect")} htmlFor="pickem-scoring-team" required error={fieldErrors.teamCorrectPoints ? t(`error.${fieldErrors.teamCorrectPoints}`) : undefined}>
                    <Input id="pickem-scoring-team" type="number" min={0} value={form.teamCorrectPoints} onChange={(e) => setForm({ ...form, teamCorrectPoints: Number(e.target.value) })} />
                  </FormField>
                  <FormField label={t("fieldOutcomeCorrect")} htmlFor="pickem-scoring-outcome" required error={fieldErrors.outcomeCorrectPoints ? t(`error.${fieldErrors.outcomeCorrectPoints}`) : undefined}>
                    <Input id="pickem-scoring-outcome" type="number" min={0} value={form.outcomeCorrectPoints} onChange={(e) => setForm({ ...form, outcomeCorrectPoints: Number(e.target.value) })} />
                  </FormField>
                  <FormField
                    label={t("fieldAdvancement")}
                    htmlFor="pickem-scoring-advancement"
                    required
                    error={fieldErrors.advancementPerRoundPoints ? t(`error.${fieldErrors.advancementPerRoundPoints}`) : undefined}
                  >
                    <Input
                      id="pickem-scoring-advancement"
                      type="number"
                      min={0}
                      value={form.advancementPerRoundPoints}
                      onChange={(e) => setForm({ ...form, advancementPerRoundPoints: Number(e.target.value) })}
                    />
                  </FormField>
                  <FormField label={t("fieldStanding")} htmlFor="pickem-scoring-standing" required error={fieldErrors.standingRankPoints ? t(`error.${fieldErrors.standingRankPoints}`) : undefined}>
                    <Input id="pickem-scoring-standing" type="number" min={0} value={form.standingRankPoints} onChange={(e) => setForm({ ...form, standingRankPoints: Number(e.target.value) })} />
                  </FormField>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSavePoints} disabled={isPending}>
                    {isPending ? t("saving") : t("save")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

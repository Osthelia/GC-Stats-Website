/**
 * GC-Stats - generate-template-form
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { generateBracketFromTemplate, type BracketFormat } from "@/actions/admin-bracket-editor";

const FORMATS: BracketFormat[] = ["single_elimination", "double_elimination", "triple_elimination", "round_robin", "round_robin_double", "gsl_group"];

type SeedMode = "seeded" | "manual";

export function GenerateTemplateForm({
  stageId,
  seededEntrants,
  onGenerated,
}: {
  stageId: number;
  seededEntrants: { id: number; seed: number }[];
  onGenerated: () => void;
}) {
  const t = useTranslations("admin.tournaments.editor");
  const [format, setFormat] = useState<BracketFormat>("single_elimination");
  const [bestOf, setBestOf] = useState("1");
  const [grandFinalBestOf, setGrandFinalBestOf] = useState("1");
  const [mode, setMode] = useState<SeedMode>(seededEntrants.length > 0 ? "seeded" : "manual");
  const [slotCount, setSlotCount] = useState("2");
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sortedSeeded = [...seededEntrants].sort((a, b) => a.seed - b.seed);
  const contiguous = sortedSeeded.length > 0 && sortedSeeded.every((e, i) => e.seed === i + 1);
  const seededEntrantIds = sortedSeeded.map((e) => e.id);

  const manualCount = Math.max(0, Math.trunc(Number(slotCount) || 0));
  // "manual" mode generates the bracket shape only — every slot is left TBD
  // (no entrant, no seed), to be assigned afterwards from the editor or the
  // match edit page (2026-09-21 user request: build a bracket without seeds).
  const entrantIdsBySeed: (number | null)[] = mode === "seeded" ? seededEntrantIds : Array.from({ length: manualCount }, () => null);

  const canGenerate = mode === "seeded" ? contiguous && seededEntrantIds.length >= 2 : manualCount >= 2;

  function handleGenerate() {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await generateBracketFromTemplate({
        stageId,
        format,
        bestOf: Number(bestOf),
        grandFinalBestOf: Number(grandFinalBestOf),
        entrantIdsBySeed,
      });
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t("generateSuccess"));
      onGenerated();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
      <FormField label={t("templateFormat")} htmlFor="editor-format" className="w-56">
        <Select items={Object.fromEntries(FORMATS.map((f) => [f, t(`format.${f}`)]))} value={format} onValueChange={(v) => v && setFormat(v as BracketFormat)}>
          <SelectTrigger id="editor-format" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {t(`format.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label={t("fieldBestOf")} htmlFor="editor-best-of" className="w-24">
        <Input id="editor-best-of" type="number" min={1} value={bestOf} onChange={(e) => setBestOf(e.target.value)} />
      </FormField>

      <FormField label={t("fieldGrandFinalBestOf")} htmlFor="editor-gf-best-of" className="w-24">
        <Input id="editor-gf-best-of" type="number" min={1} value={grandFinalBestOf} onChange={(e) => setGrandFinalBestOf(e.target.value)} />
      </FormField>

      <FormField label={t("seedModeLabel")} htmlFor="editor-seed-mode" className="w-48">
        <Select items={{ seeded: t("seedModeSeeded"), manual: t("seedModeManual") }} value={mode} onValueChange={(v) => v && setMode(v as SeedMode)}>
          <SelectTrigger id="editor-seed-mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="seeded">{t("seedModeSeeded")}</SelectItem>
            <SelectItem value="manual">{t("seedModeManual")}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {mode === "manual" && (
        <FormField label={t("slotCountLabel")} htmlFor="editor-slot-count" className="w-24" hint={t("slotCountHint")}>
          <Input id="editor-slot-count" type="number" min={2} value={slotCount} onChange={(e) => setSlotCount(e.target.value)} />
        </FormField>
      )}

      <Button onClick={() => setConfirmOpen(true)} disabled={isPending || !canGenerate}>
        {isPending ? t("generating") : t("generateButton")}
      </Button>

      {mode === "seeded" && !contiguous && <p className="w-full text-xs text-destructive">{t("seedsNotContiguous")}</p>}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("generateButton")}
        description={t("generateConfirm")}
        confirmLabel={t("generateButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleGenerate}
      />
    </div>
  );
}

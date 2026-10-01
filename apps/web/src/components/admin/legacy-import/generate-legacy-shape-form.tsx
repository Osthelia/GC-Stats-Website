/**
 * GC-Stats - generate-legacy-shape-form
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
import { generateLegacyBracketShape } from "@/actions/admin-legacy-bracket-import";
import type { BracketFormat } from "@/actions/admin-bracket-editor";

const FORMATS: BracketFormat[] = ["single_elimination", "double_elimination", "triple_elimination", "round_robin", "round_robin_double", "gsl_group"];

export function GenerateLegacyShapeForm({ stageId, onGenerated }: { stageId: number; onGenerated: () => void }) {
  const t = useTranslations("admin.tournaments.legacyImport");
  const tEditor = useTranslations("admin.tournaments.editor");
  const [format, setFormat] = useState<BracketFormat>("single_elimination");
  const [bestOf, setBestOf] = useState("1");
  const [grandFinalBestOf, setGrandFinalBestOf] = useState("1");
  const [slotCount, setSlotCount] = useState("2");
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parsedSlotCount = Math.max(0, Math.trunc(Number(slotCount) || 0));
  const canGenerate = parsedSlotCount >= 2;

  function handleGenerate() {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await generateLegacyBracketShape({ stageId, format, bestOf: Number(bestOf), grandFinalBestOf: Number(grandFinalBestOf), slotCount: parsedSlotCount });
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
      <FormField label={tEditor("templateFormat")} htmlFor="legacy-import-format" className="w-56">
        <Select items={Object.fromEntries(FORMATS.map((f) => [f, tEditor(`format.${f}`)]))} value={format} onValueChange={(v) => v && setFormat(v as BracketFormat)}>
          <SelectTrigger id="legacy-import-format" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {tEditor(`format.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label={tEditor("fieldBestOf")} htmlFor="legacy-import-best-of" className="w-24">
        <Input id="legacy-import-best-of" type="number" min={1} value={bestOf} onChange={(e) => setBestOf(e.target.value)} />
      </FormField>

      <FormField label={tEditor("fieldGrandFinalBestOf")} htmlFor="legacy-import-gf-best-of" className="w-24">
        <Input id="legacy-import-gf-best-of" type="number" min={1} value={grandFinalBestOf} onChange={(e) => setGrandFinalBestOf(e.target.value)} />
      </FormField>

      <FormField label={tEditor("slotCountLabel")} htmlFor="legacy-import-slot-count" className="w-24">
        <Input id="legacy-import-slot-count" type="number" min={2} value={slotCount} onChange={(e) => setSlotCount(e.target.value)} />
      </FormField>

      <Button onClick={() => setConfirmOpen(true)} disabled={isPending || !canGenerate}>
        {isPending ? t("generating") : t("generateButton")}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("generateButton")}
        description={t("generateConfirm")}
        confirmLabel={t("generateButton")}
        cancelLabel={tEditor("cancel")}
        onConfirm={handleGenerate}
      />
    </div>
  );
}

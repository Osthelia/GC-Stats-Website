/**
 * GC-Stats - tournament-liquipedia-brackets-panel
 *
 * Links each bracket of a tournament to its Liquipedia bracket template: paste
 * the wikicode of the stage, review the detected templates (click a row to
 * toggle it), save the checked ones.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiquipediaMappingTable, type RowState } from "@/components/admin/liquipedia-mapping-table";
import { saveLiquipediaBracketTemplates, type LiquipediaBracketRowError } from "@/actions/admin-liquipedia";
import { parseBracketEntries, validateBracketTemplate, type BracketEntry } from "@/lib/liquipedia-bracket-wikicode";
import type { LiquipediaBracketGroup } from "@/lib/admin-liquipedia";
import { cn } from "@/lib/utils";

function initialRows(brackets: LiquipediaBracketGroup[]): Record<number, RowState> {
  return Object.fromEntries(brackets.map((b) => [b.id, b.template ? { name: b.template, checked: false, confidence: "linked", score: null } : { name: "", checked: false, confidence: "none", score: null }]));
}

/**
 * The entry written for this stage (`matchsection=` equal to the stage name), else the only one of the wikicode.
 * When several unlinked brackets share the stage, the name is only a hint and stays unchecked.
 */
function suggestTemplate(bracket: LiquipediaBracketGroup, entries: BracketEntry[], unlinked: LiquipediaBracketGroup[]): { name: string; confident: boolean; checked: boolean } | null {
  const stageEntries = entries.filter((e) => e.matchSection?.toLowerCase() === bracket.stageName.toLowerCase());
  const templates = new Set(stageEntries.map((e) => e.template));
  if (templates.size === 1) {
    const sharesStage = unlinked.filter((b) => b.stageName.toLowerCase() === bracket.stageName.toLowerCase()).length > 1;
    return { name: [...templates][0]!, confident: !sharesStage, checked: !sharesStage };
  }
  if (entries.length === 1 && unlinked.length === 1) return { name: entries[0]!.template, confident: false, checked: true };
  return null;
}

export function TournamentLiquipediaBracketsPanel({ tournamentId, brackets, canManage }: { tournamentId: number; brackets: LiquipediaBracketGroup[]; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.liquipedia");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wikicode, setWikicode] = useState("");
  const [entries, setEntries] = useState<BracketEntry[] | null>(null);
  const [rows, setRows] = useState<Record<number, RowState>>(() => initialRows(brackets));
  const [rowErrors, setRowErrors] = useState<Record<number, LiquipediaBracketRowError>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const checkedCount = Object.values(rows).filter((r) => r.checked).length;
  const missingCount = brackets.filter((b) => rows[b.id]?.confidence !== "linked").length;
  const suggestions = useMemo(() => [...new Set((entries ?? []).map((e) => e.template))], [entries]);

  function handleAnalyze() {
    const found = parseBracketEntries(wikicode);
    setEntries(found);
    setRowErrors({});
    setFormError(null);
    // Hand-edited rows are kept as they are.
    const unlinked = brackets.filter((b) => rows[b.id]?.confidence !== "linked" && rows[b.id]?.confidence !== "manual");
    setRows((current) => {
      const next = { ...current };
      for (const bracket of unlinked) {
        const suggestion = suggestTemplate(bracket, found, unlinked);
        next[bracket.id] = suggestion
          ? { name: suggestion.name, checked: suggestion.checked, confidence: suggestion.confident ? "confident" : "possible", score: null }
          : { name: "", checked: false, confidence: "none", score: null };
      }
      return next;
    });
  }

  function toggleRow(id: number) {
    if (!canManage) return;
    setRows((current) => ({ ...current, [id]: { ...current[id]!, checked: !current[id]!.checked } }));
  }

  function editName(id: number, name: string) {
    setRowErrors(({ [id]: _removed, ...rest }) => rest);
    setRows((current) => {
      const row = current[id]!;
      const unchanged = row.confidence === "linked" && brackets.find((b) => b.id === id)?.template === name;
      return { ...current, [id]: { name, checked: name.trim() !== "" && !unchanged, confidence: row.confidence === "linked" ? "linked" : "manual", score: null } };
    });
  }

  function handleSave() {
    setFormError(null);
    const payload = Object.entries(rows)
      .filter(([, row]) => row.checked)
      .map(([id, row]) => ({ bracketId: Number(id), template: row.name.trim() }));

    // Same checks as the server, so obvious mistakes show without a round trip.
    const localErrors: Record<number, LiquipediaBracketRowError> = {};
    for (const row of payload) {
      const error = validateBracketTemplate(row.template);
      if (error) localErrors[row.bracketId] = { error };
    }
    if (Object.keys(localErrors).length > 0) {
      setRowErrors(localErrors);
      return;
    }

    startTransition(async () => {
      const result = await saveLiquipediaBracketTemplates(tournamentId, payload);
      if (!result.ok) {
        setRowErrors(result.rowErrors);
        if (result.error) setFormError(t(`error.${result.error}`));
        else toast.error(t("error.rows"));
        return;
      }
      setRows((current) => {
        const next = { ...current };
        for (const row of payload) next[row.bracketId] = { name: row.template, checked: false, confidence: "linked", score: null };
        return next;
      });
      toast.success(t("brackets.saveSuccess", { count: result.saved }));
      router.refresh();
    });
  }

  if (brackets.length === 0) return <p className="text-sm text-muted-foreground">{t("brackets.noBrackets")}</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">{t("brackets.wikicodeTitle")}</CardTitle>
          <CardDescription>{t("brackets.wikicodeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea rows={10} value={wikicode} onChange={(e) => setWikicode(e.target.value)} placeholder={t("brackets.wikicodePlaceholder")} className="font-mono text-xs" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleAnalyze} disabled={wikicode.trim() === ""}>
              {t("brackets.analyzeButton")}
            </Button>
            {entries !== null && (
              <span className={cn("text-xs", entries.length === 0 ? "text-destructive" : "text-muted-foreground")}>
                {entries.length === 0 ? t("brackets.noneFound") : t("brackets.foundCount", { count: entries.length })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("brackets.tableTitle", { missing: missingCount, total: brackets.length })}</CardTitle>
          <CardDescription>{t("toggleHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <LiquipediaMappingTable
            items={brackets.map((bracket) => ({
              id: bracket.id,
              label: bracket.label ? `${bracket.stageName}, ${bracket.label}` : bracket.stageName,
              sublabel: bracket.containerNames.join(", "),
              currentName: bracket.template,
            }))}
            rows={rows}
            rowErrors={rowErrors}
            suggestions={suggestions}
            canManage={canManage}
            labelColumn={t("brackets.columnBracket")}
            nameColumn={t("brackets.columnTemplate")}
            namePlaceholder={t("brackets.templatePlaceholder")}
            errorText={(error) => t(`brackets.error.${error.error}`)}
            onToggle={toggleRow}
            onEditName={editName}
          />

          {formError && (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          )}
          {canManage && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{t("checkedCount", { count: checkedCount })}</span>
              <Button onClick={handleSave} disabled={isPending || checkedCount === 0}>
                {isPending ? t("saving") : t("saveButton")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

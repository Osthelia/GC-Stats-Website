/**
 * GC-Stats - tournament-liquipedia-talent-panel
 *
 * Imports the Talent section of a Liquipedia tournament page as production
 * credits: paste the wikicode, check who is matched to which person, import.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonPicker } from "@/components/admin/person-picker";
import { searchLiquipediaPeople } from "@/actions/admin-liquipedia";
import { importBroadcastCredits, previewBroadcastImport, type BroadcastPreviewRow, type BroadcastRowError } from "@/actions/liquipedia-broadcast-import";
import { cn } from "@/lib/utils";

type Row = BroadcastPreviewRow & { checked: boolean };

export function TournamentLiquipediaTalentPanel({ tournamentId, canManage }: { tournamentId: number; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.liquipedia.talent");
  const router = useRouter();
  const [isAnalyzing, startAnalyze] = useTransition();
  const [isImporting, startImport] = useTransition();
  const [wikicode, setWikicode] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, BroadcastRowError>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const checkedCount = rows?.filter((r) => r.checked).length ?? 0;

  function handleAnalyze() {
    setFormError(null);
    setRowErrors({});
    startAnalyze(async () => {
      const result = await previewBroadcastImport(tournamentId, wikicode);
      if (!result.ok) {
        setRows(null);
        setFormError(t(`error.${result.error}`));
        return;
      }
      setRows(result.rows.map((row) => ({ ...row, checked: row.person !== null })));
    });
  }

  function updateRow(name: string, patch: Partial<Row>) {
    setRowErrors(({ [name]: _removed, ...rest }) => rest);
    setRows((current) => current?.map((row) => (row.name === name ? { ...row, ...patch } : row)) ?? null);
  }

  function handleImport() {
    if (!rows) return;
    setFormError(null);
    const selected = rows.filter((r) => r.checked);
    const localErrors: Record<string, BroadcastRowError> = {};
    for (const row of selected) if (!row.person) localErrors[row.name] = "personRequired";
    if (Object.keys(localErrors).length > 0) {
      setRowErrors(localErrors);
      return;
    }

    startImport(async () => {
      const result = await importBroadcastCredits(
        tournamentId,
        selected.map((r) => ({ name: r.name, personId: r.person?.id ?? null, credits: r.credits }))
      );
      if (!result.ok) {
        setRowErrors(result.rowErrors);
        if (result.error) setFormError(t(`error.${result.error}`));
        else toast.error(t("error.rows"));
        return;
      }
      toast.success(t("success", { created: result.created, skipped: result.skipped }));
      setRows(null);
      setWikicode("");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">{t("wikicodeTitle")}</CardTitle>
          <CardDescription>{t("wikicodeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea rows={12} value={wikicode} onChange={(e) => setWikicode(e.target.value)} placeholder={t("wikicodePlaceholder")} className="font-mono text-xs" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleAnalyze} disabled={isAnalyzing || wikicode.trim() === ""}>
              {isAnalyzing && <Loader2Icon className="animate-spin" />}
              {isAnalyzing ? t("analyzing") : t("analyzeButton")}
            </Button>
            {rows !== null && <span className="text-xs text-muted-foreground">{t("parsedCount", { count: rows.length })}</span>}
          </div>
          {formError && rows === null && (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("tableTitle")}</CardTitle>
          <CardDescription>{t("tableDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows === null ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="flex flex-col divide-y rounded-md border">
              {rows.map((row) => (
                <div key={row.name} className="grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[auto_1fr_1fr]">
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => updateRow(row.name, { checked: !row.checked })}
                    aria-label={row.name}
                    className={cn("flex size-4 items-center justify-center rounded border transition-colors active:opacity-60", row.checked ? "border-primary bg-primary text-primary-foreground" : "border-input")}
                  >
                    {row.checked && <CheckIcon className="size-3" />}
                  </button>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-medium">{row.name}</span>
                    <div className="flex flex-wrap items-center gap-1">
                      {row.credits.map((credit) => (
                        <Badge key={`${credit.role}:${credit.title ?? ""}`} className="bg-muted text-[10px] text-muted-foreground">
                          {credit.title ?? credit.role}
                        </Badge>
                      ))}
                      {row.alreadyCredited > 0 && <span className="text-[10px] text-muted-foreground">{t("alreadyCredited", { count: row.alreadyCredited })}</span>}
                    </div>
                    {rowErrors[row.name] && (
                      <p role="alert" className="text-xs text-destructive">
                        {t(`rowError.${rowErrors[row.name]}`)}
                      </p>
                    )}
                  </div>
                  <PersonPicker
                    value={row.person ? { id: row.person.id, handle: row.person.handle } : null}
                    onChange={(person) => updateRow(row.name, { person: person ? { id: person.id, handle: person.handle } : null, checked: person !== null })}
                    placeholder={t("pickPerson")}
                    searchPlaceholder={t("searchPerson")}
                    noResultsLabel={t("noResults")}
                    search={(query) => searchLiquipediaPeople(query, null)}
                  />
                </div>
              ))}
            </div>
          )}

          {formError && rows !== null && (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          )}
          {canManage && rows !== null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{t("checkedCount", { count: checkedCount })}</span>
              <Button onClick={handleImport} disabled={isImporting || checkedCount === 0}>
                {isImporting && <Loader2Icon className="animate-spin" />}
                {isImporting ? t("importing") : t("importButton")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

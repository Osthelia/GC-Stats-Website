/**
 * GC-Stats - match-wikicode-import
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importMatchWikicode, type LiquipediaConflictResolution, type LiquipediaImportConflict } from "@/actions/admin-matches";
import { cn } from "@/lib/utils";

type Resolutions = Partial<Record<"1" | "2", LiquipediaConflictResolution>>;

/** Port of V1's "Import from wikicode" card (admin/matches/edit.blade.php) — paste a Liquipedia {{MapVeto}}/{{mapN}} block, rebuild veto + maps from it. */
export function MatchWikicodeImport({ matchId, canManage }: { matchId: number; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.matches.wikicode");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wikicode, setWikicode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<LiquipediaImportConflict[] | null>(null);
  const [resolutions, setResolutions] = useState<Resolutions>({});

  if (!canManage) return null;

  function runImport(chosen: Resolutions) {
    setError(null);
    startTransition(async () => {
      const result = await importMatchWikicode(matchId, wikicode, chosen);
      if (!result.ok) {
        if (result.error === "liquipediaConflict" && "conflicts" in result) {
          setResolutions({});
          setConflicts(result.conflicts);
          return;
        }
        setConflicts(null);
        setError(t(`error.${result.error}`));
        return;
      }
      setConflicts(null);
      setWikicode("");
      router.refresh();
      toast.success(result.linkedNames > 0 ? t("importSuccessLinked", { count: result.linkedNames }) : t("importSuccess"));
    });
  }

  function handleImport() {
    if (!window.confirm(t("importConfirm"))) return;
    runImport({});
  }

  const allResolved = conflicts?.every((c) => resolutions[String(c.slot) as "1" | "2"]) ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>
          {t("description")} {t("liquipediaHint")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          rows={6}
          placeholder={t("placeholder")}
          value={wikicode}
          onChange={(e) => setWikicode(e.target.value)}
          className="font-mono text-xs"
          aria-invalid={!!error}
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div>
          <Button variant="outline" onClick={handleImport} disabled={isPending || wikicode.trim() === ""}>
            {isPending ? t("importing") : t("importButton")}
          </Button>
        </div>
      </CardContent>

      <Dialog open={conflicts !== null} onOpenChange={(open) => !open && !isPending && setConflicts(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("conflict.title")}</DialogTitle>
            <DialogDescription>{t("conflict.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {conflicts?.map((conflict) => {
              const key = String(conflict.slot) as "1" | "2";
              const choice = resolutions[key];
              const option = (value: LiquipediaConflictResolution, label: string) => (
                <button
                  type="button"
                  onClick={() => setResolutions((current) => ({ ...current, [key]: value }))}
                  aria-pressed={choice === value}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-left text-xs transition-colors active:scale-[0.98]",
                    choice === value ? "border-primary bg-primary/10 text-foreground" : "border-input text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              );
              return (
                <div key={conflict.slot} className="flex flex-col gap-2 rounded-md border p-3">
                  <p className="font-medium">{conflict.teamName}</p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    <li>{t("conflict.importSays", { name: conflict.importName })}</li>
                    {conflict.currentNameForTeam && <li>{t("conflict.teamLinkedTo", { name: conflict.currentNameForTeam })}</li>}
                    {conflict.currentTeamForName && <li>{t("conflict.nameLinkedTo", { name: conflict.importName, team: conflict.currentTeamForName.teamName })}</li>}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {option("keep", t("conflict.keep"))}
                    {option("import", t("conflict.useImport", { name: conflict.importName, team: conflict.teamName }))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflicts(null)} disabled={isPending}>
              {t("conflict.cancel")}
            </Button>
            <Button onClick={() => runImport(resolutions)} disabled={isPending || !allResolved}>
              {isPending ? t("importing") : t("conflict.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

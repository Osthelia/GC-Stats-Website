/**
 * GC-Stats - tournament-liquipedia-panel
 *
 * Completes a tournament's missing Liquipedia team names, one stage at a
 * time: paste the stage's participants wikicode, review the suggested
 * matches (click a row to toggle it), save the checked ones.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiquipediaMappingTable, type RowState } from "@/components/admin/liquipedia-mapping-table";
import { saveLiquipediaTeamNames, type LiquipediaRowError } from "@/actions/admin-liquipedia";
import { parseParticipantNames, suggestTeamMatches } from "@/lib/liquipedia-team-match";
import { validateLiquipediaName } from "@/lib/liquipedia-name-validation";
import type { LiquipediaStage, LiquipediaStageTeam } from "@/lib/admin-liquipedia";
import { cn } from "@/lib/utils";

function initialRows(teams: LiquipediaStageTeam[]): Record<number, RowState> {
  return Object.fromEntries(
    teams.map((team) => [
      team.teamId,
      team.liquipediaName
        ? { name: team.liquipediaName, checked: false, confidence: "linked", score: null }
        : { name: "", checked: false, confidence: "none", score: null },
    ])
  );
}

export function TournamentLiquipediaPanel({ tournamentId, stages, canManage }: { tournamentId: number; stages: LiquipediaStage[]; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.liquipedia");
  const [stageId, setStageId] = useState<number>(() => (stages.find((s) => s.teams.some((team) => !team.liquipediaName)) ?? stages[0])?.id ?? 0);
  const stage = stages.find((s) => s.id === stageId);

  if (stages.length === 0 || !stage) return <p className="text-sm text-muted-foreground">{t("noStages")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={stageId} onValueChange={(value) => setStageId(Number(value))}>
        <TabsList className="h-auto flex-wrap">
          {stages.map((s) => {
            const linked = s.teams.filter((team) => team.liquipediaName).length;
            return (
              <TabsTrigger key={s.id} value={s.id} className="gap-2">
                {s.name}
                <span className={cn("rounded px-1.5 text-[10px] tabular-nums", linked === s.teams.length ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>
                  {linked}/{s.teams.length}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <StagePanel key={stage.id} tournamentId={tournamentId} stage={stage} canManage={canManage} />
    </div>
  );
}

function StagePanel({ tournamentId, stage, canManage }: { tournamentId: number; stage: LiquipediaStage; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.liquipedia");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wikicode, setWikicode] = useState("");
  const [parsedNames, setParsedNames] = useState<string[] | null>(null);
  const [showLinked, setShowLinked] = useState(false);
  const [rows, setRows] = useState<Record<number, RowState>>(() => initialRows(stage.teams));
  const [rowErrors, setRowErrors] = useState<Record<number, LiquipediaRowError>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const missingCount = stage.teams.filter((team) => rows[team.teamId]?.confidence !== "linked").length;
  const visibleTeams = useMemo(() => {
    const list = stage.teams.filter((team) => showLinked || rows[team.teamId]?.confidence !== "linked");
    const rank = (team: LiquipediaStageTeam) => (rows[team.teamId]?.confidence === "linked" ? 1 : 0);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [stage.teams, rows, showLinked]);
  const checkedCount = Object.values(rows).filter((r) => r.checked).length;

  // Names already held by a team of this stage aren't offered again.
  const availableNames = useMemo(() => {
    const taken = new Set(Object.values(rows).filter((r) => r.confidence === "linked").map((r) => r.name.toLowerCase()));
    return (parsedNames ?? []).filter((name) => !taken.has(name.toLowerCase()));
  }, [parsedNames, rows]);

  function handleAnalyze() {
    const names = parseParticipantNames(wikicode);
    setParsedNames(names);
    setRowErrors({});
    setFormError(null);
    const takenNames = new Set(Object.values(rows).filter((r) => r.confidence === "linked").map((r) => r.name.toLowerCase()));
    const candidates = stage.teams.filter((team) => rows[team.teamId]?.confidence !== "linked").map((team) => ({ teamId: team.teamId, names: team.names }));
    const suggestions = suggestTeamMatches(
      candidates,
      names.filter((name) => !takenNames.has(name.toLowerCase()))
    );
    setRows((current) => {
      const next = { ...current };
      for (const candidate of candidates) next[candidate.teamId] = { name: "", checked: false, confidence: "none", score: null };
      for (const s of suggestions) {
        next[s.teamId] = { name: s.liquipediaName, checked: s.confidence !== "possible", confidence: s.confidence, score: s.score };
      }
      return next;
    });
  }

  function toggleRow(teamId: number) {
    if (!canManage) return;
    setRows((current) => ({ ...current, [teamId]: { ...current[teamId]!, checked: !current[teamId]!.checked } }));
  }

  function editName(teamId: number, name: string) {
    setRowErrors(({ [teamId]: _removed, ...rest }) => rest);
    setRows((current) => {
      const row = current[teamId]!;
      const wasLinkedUnchanged = row.confidence === "linked" && stage.teams.find((team) => team.teamId === teamId)?.liquipediaName === name;
      return { ...current, [teamId]: { name, checked: name.trim() !== "" && !wasLinkedUnchanged, confidence: row.confidence === "linked" ? "linked" : "manual", score: null } };
    });
  }

  function handleSave() {
    setFormError(null);
    const payload = Object.entries(rows)
      .filter(([, row]) => row.checked)
      .map(([teamId, row]) => ({ teamId: Number(teamId), name: row.name.trim() }));

    // Same checks as the server, so obvious mistakes show without a round trip.
    const localErrors: Record<number, LiquipediaRowError> = {};
    for (const row of payload) {
      const error = validateLiquipediaName(row.name);
      if (error) localErrors[row.teamId] = { error };
    }
    if (Object.keys(localErrors).length > 0) {
      setRowErrors(localErrors);
      return;
    }

    startTransition(async () => {
      const result = await saveLiquipediaTeamNames(tournamentId, payload);
      if (!result.ok) {
        setRowErrors(result.rowErrors);
        if (result.error) setFormError(t(`error.${result.error}`));
        else toast.error(t("error.rows"));
        return;
      }
      setRows((current) => {
        const next = { ...current };
        for (const row of payload) next[row.teamId] = { name: row.name, checked: false, confidence: "linked", score: null };
        return next;
      });
      toast.success(t("saveSuccess", { count: result.saved }));
      router.refresh();
    });
  }

  if (stage.teams.length === 0) return <p className="text-sm text-muted-foreground">{t("noTeams")}</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">{t("wikicodeTitle")}</CardTitle>
          <CardDescription>{t("wikicodeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {stage.liquipediaLink && (
            <a
              href={stage.liquipediaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-sky-400 transition-opacity hover:underline active:opacity-60"
            >
              <ExternalLinkIcon className="size-3.5" />
              {t("stageLink")}
            </a>
          )}
          <Textarea
            rows={10}
            value={wikicode}
            onChange={(e) => setWikicode(e.target.value)}
            placeholder={t("wikicodePlaceholder")}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleAnalyze} disabled={wikicode.trim() === ""}>
              {t("analyzeButton")}
            </Button>
            {parsedNames !== null && (
              <span className={cn("text-xs", parsedNames.length === 0 ? "text-destructive" : "text-muted-foreground")}>
                {parsedNames.length === 0 ? t("noNamesFound") : t("parsedCount", { count: parsedNames.length })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("tableTitle", { missing: missingCount, total: stage.teams.length })}</CardTitle>
          <CardDescription>{t("toggleHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowLinked((v) => !v)}
            className="flex w-fit items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground active:opacity-60"
          >
            <span className={cn("flex size-4 items-center justify-center rounded border", showLinked ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
              {showLinked && <CheckIcon className="size-3" />}
            </span>
            {t("showLinked")}
          </button>

          {missingCount === 0 && !showLinked ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{t("allLinked")}</p>
          ) : (
            <LiquipediaMappingTable
              items={visibleTeams.map((team) => ({ id: team.teamId, label: team.displayName, currentName: team.liquipediaName }))}
              rows={rows}
              rowErrors={rowErrors}
              suggestions={availableNames}
              canManage={canManage}
              labelColumn={t("columnTeam")}
              errorText={(error) => t(`error.${error.error}`, { team: error.teamName ?? "" })}
              onToggle={toggleRow}
              onEditName={editName}
            />
          )}

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

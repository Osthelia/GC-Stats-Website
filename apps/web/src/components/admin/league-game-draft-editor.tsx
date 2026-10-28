/**
 * GC-Stats - league-game-draft-editor
 *
 * The draft of one League game: the blue side and the first pick, then one column per team with a champion for
 * each of its steps (empty steps are normal) and the picks not placed yet. Imported games start from their import.
 * Nothing is stored until Save, which replaces the game's draft in one transaction.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchablePicker } from "@/components/admin/searchable-picker";
import { saveLeagueGameDraft, type LeagueDraftError } from "@/actions/admin-lol-games";
import type { LeagueDraftView } from "@/lib/admin-matches";
import { LEAGUE_DRAFT_STEPS, draftStep, stepSide, type DraftPhase, type LeagueSide } from "@gc-stats/lol-stats-engine";
import { useGame } from "@/lib/use-game";
import { LolSideBadge } from "@/components/admin/lol-side-badge";

const PHASES: DraftPhase[] = ["ban1", "pick1", "ban2", "pick2"];

export function LeagueGameDraftEditor({
  tournamentId,
  matchId,
  entrants,
  draft,
  champions,
  canManage,
}: {
  tournamentId: number;
  matchId: number;
  /** Entrant A and B of the series, with their names. */
  entrants: { id: number; name: string }[];
  draft: LeagueDraftView;
  /** Every champion the catalog names, for the pickers. */
  champions: string[];
  canManage: boolean;
}) {
  const game = useGame();
  const t = useTranslations("admin.tournaments.matches.draft");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [blueEntrantId, setBlueEntrantId] = useState(draft.blueEntrantId ?? entrants[0]?.id ?? 0);
  const [firstPick, setFirstPick] = useState<LeagueSide>(draft.firstPick);
  const [steps, setSteps] = useState<Record<number, string>>(() => Object.fromEntries(draft.steps.map((s) => [s.step, s.championName])));

  const pickedChamps = useMemo(() => new Set(Object.values(steps)), [steps]);
  // Champions that are in the data but not in the picks
  const unpacedChamps = draft.unplacedPicks.filter((pick) => !pickedChamps.has(pick.championName));
  const canEditBlue = canManage && !draft.imported;
  const canEditFirstPick = canManage && !draft.firstPickLocked;

  const entrantFor = (side: LeagueSide): number => (side === "blue" ? blueEntrantId : (entrants.find((e) => e.id !== blueEntrantId)?.id ?? blueEntrantId));
  const entrantName = (side: LeagueSide): string => entrants.find((e) => e.id === entrantFor(side))?.name ?? "";
  const sideName = (side: LeagueSide) => t(`side.${side}`);

  function setStep(step: number, championName: string | null) {
    setSteps((prev) => {
      const next = { ...prev };
      if (championName === null) delete next[step];
      else next[step] = championName;
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveLeagueGameDraft(game, tournamentId, matchId, draft.gameId, {
        blueEntrantId,
        firstPick,
        steps: Object.entries(steps).map(([step, championName]) => ({ step: Number(step), championName })),
        unplacedPicks: unpacedChamps.map((pick) => ({ side: pick.side, championName: pick.championName })),
      });
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      toast.success(t("saved"));
      router.push(`/admin/tournaments/${tournamentId}/matches/${matchId}`);
    });
  }

  function errorText(error: LeagueDraftError): string {
    if (error.kind !== "draftProblem") return t(`error.${error.kind}`);
    const problem = error.problem;
    if (problem.kind === "invalidStep") return t("error.invalidStep", { step: problem.step });
    if (problem.kind === "unknownChampion") return t("error.unknownChampion", { championName: problem.championName });
    return t("error.duplicateChampion", { championName: problem.championName });
  }

  const entrantItems = Object.fromEntries(entrants.map((e) => [String(e.id), e.name]));
  const firstPickItems: Record<string, string> = { blue: entrantName("blue"), red: entrantName("red") };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="text-lg font-semibold">{t("blueSide")}</div>
          {canEditBlue ? (
            <Select items={entrantItems} value={String(blueEntrantId)} onValueChange={(value) => setBlueEntrantId(Number(value))}>
              <SelectTrigger className="w-full" aria-label={t("blueSide")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entrants.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-md">
              {entrantName("blue")} <span className="text-sm text-muted-foreground">{draft.imported ? t("blueLockedHint") : ""}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-lg font-semibold">{t("firstPick")}</div>
          {canEditFirstPick ? (
            <Select items={firstPickItems} value={firstPick} onValueChange={(value) => setFirstPick(value as LeagueSide)}>
              <SelectTrigger className="w-full" aria-label={t("firstPick")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blue">{entrantName("blue")}</SelectItem>
                <SelectItem value="red">{entrantName("red")}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-md">
              {entrantName(firstPick)} <span className="text-sm text-muted-foreground">{draft.firstPickLocked ? t("firstPickLockedHint") : ""}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {(["blue", "red"] as const).map((side) => (
          <div key={side} className="flex flex-col gap-4">
            <div className="flex flex-row gap-2 items-center">
              <h2 className="text-md font-semibold">{entrantName(side)} </h2>
              <LolSideBadge side={side} label={sideName(side)} />
            </div>

            {PHASES.map((phase) => (
              <section key={phase} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t(`phase.${phase}`)}</h3>
                {LEAGUE_DRAFT_STEPS.filter((s) => s.phase === phase && stepSide(s, firstPick) === side).map((s) => {
                  const current = steps[s.step] ?? null;
                  const usedElsewhere = new Set(Object.entries(steps).filter(([step]) => Number(step) !== s.step).map(([, name]) => name));
                  const options = champions.map((name) => ({ id: name, label: name, disabled: usedElsewhere.has(name) }));
                  return (
                    <div key={s.step} className="flex flex-row items-center gap-3">
                      <span className="w-15 text-sm">
                        {t(`type.${s.type}`)} {typeNumber(s.step)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <SearchablePicker
                          value={current}
                          options={options}
                          onChange={(id) => setStep(s.step, id)}
                          placeholder={t("noChampion")}
                          noneLabel={t("noChampion")}
                          searchPlaceholder={t("searchPlaceholder")}
                          noResultsLabel={t("noResults")}
                        />
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}

            {unpacedChamps.some((pick) => pick.side === side) && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t("unplacedTitle")}</h3>
                <div className="text-sm">{unpacedChamps.filter((pick) => pick.side === side).map((pick) => pick.championName).join(", ")}</div>
              </section>
            )}
          </div>
        ))}
      </div>

      <div>
        <Button onClick={save} disabled={!canManage || isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}

/** The number of a ban or pick among its kind: "ban 1" to "ban 10", "pick 1" to "pick 10". */
function typeNumber(step: number): number {
  const s = draftStep(step);
  if (!s) return step;
  return LEAGUE_DRAFT_STEPS.filter((other) => other.type === s.type && other.step <= step).length;
}

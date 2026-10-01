/**
 * GC-Stats - pickem-pick-form
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
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TournamentContainerTabs, type TournamentContainerTab } from "@/components/tournament/tournament-container-tabs";
import { groupBracketContainers } from "@/lib/bracket-group-containers";
import { submitStagePicks } from "@/actions/pickem";
import { computeVirtualBracket, getPickableMatches, getDownstreamMatchIds } from "@/lib/pickem/bracket-fill";
import type { PickFormData } from "@/lib/pickem/pickem-data";
import type { PhaseScoringConfig } from "@/lib/pickem/scoring";
import { PickemBracketCanvas } from "@/components/pickem/pickem-bracket-canvas";

const NO_SELECTION = "none";

/**
 * Same skeleton as the real bracket page (`TournamentOverview`): bracket
 * containers of a single physical bracket merge into ONE canvas (upper/lower/
 * grand final drawn as connected lanes), several independent physical
 * brackets under the same stage switch via `TournamentContainerTabs`
 * (`groupBracketContainers`) — the exact same helper/component, not a
 * lookalike. Group/Swiss standing-pick containers get their own tabs the
 * same way the real page tabs its non-bracket containers.
 */
export function PickemPickForm({ stageId, data, scoringConfig }: { stageId: number; data: PickFormData; scoringConfig: PhaseScoringConfig }) {
  const t = useTranslations("pickemPage");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matchPicks, setMatchPicks] = useState<Record<number, number>>(data.initialMatchPicks);
  const [standingPicks, setStandingPicks] = useState<Record<number, Record<number, number>>>(data.initialStandingPicks);
  // Whether the user already had predictions saved when the page loaded — while pick'em stays open, they can always come back and change them (full delete+reinsert on save, see `saveStagePicks`), this only changes the button/toast wording so it's clear an edit is being saved, not a first submission.
  const hasExistingPicks = Object.keys(data.initialMatchPicks).length > 0 || Object.keys(data.initialStandingPicks).length > 0;

  const matchPicksMap = useMemo(() => new Map(Object.entries(matchPicks).map(([k, v]) => [Number(k), v])), [matchPicks]);
  const predictedGroupRank = (containerId: number, rank: number): number | null => standingPicks[containerId]?.[rank] ?? null;

  const virtual = useMemo(
    () => computeVirtualBracket(data.bracketMatches, data.bracketEdges, matchPicksMap, predictedGroupRank),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.bracketMatches, data.bracketEdges, matchPicksMap, standingPicks]
  );
  const pickableMatchIds = useMemo(() => new Set(getPickableMatches(virtual).map((m) => m.matchId)), [virtual]);

  function pickWinner(matchId: number, entrantId: number) {
    // Changing a pick can invalidate any downstream virtual matchup, in this container's later rounds or, for a double/triple elimination stage, a DIFFERENT container fed by this match's loser — drop them all, matching how bracket predictors elsewhere behave.
    const downstream = getDownstreamMatchIds(matchId, data.bracketEdges);
    setMatchPicks((prev) => {
      const next: Record<number, number> = {};
      for (const [key, value] of Object.entries(prev)) {
        const id = Number(key);
        if (downstream.has(id)) continue;
        next[id] = value;
      }
      next[matchId] = entrantId;
      return next;
    });
  }

  function pickStandingRank(containerId: number, rank: number, entrantId: number) {
    // A standings prediction can feed a bracket seed (group_rank) — clearing all bracket picks on change keeps the form always internally consistent, simplest correct behavior.
    setMatchPicks({});
    setStandingPicks((prev) => ({ ...prev, [containerId]: { ...prev[containerId], [rank]: entrantId } }));
  }

  function handleSubmit() {
    const matchPicksInput = Object.entries(matchPicks).map(([matchId, entrantId]) => ({ matchId: Number(matchId), entrantId }));
    const standingPicksInput = Object.entries(standingPicks).flatMap(([containerId, ranks]) =>
      Object.entries(ranks).map(([rank, entrantId]) => ({ containerId: Number(containerId), predictedRank: Number(rank), entrantId }))
    );

    startTransition(async () => {
      const result = await submitStagePicks(stageId, { matchPicks: matchPicksInput, standingPicks: standingPicksInput });
      if (!result.ok) {
        toast.error(t(`saveError.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t(hasExistingPicks ? "updateSuccess" : "saveSuccess"));
    });
  }

  const groupsComplete = data.groupContainers.every((c) => {
    const picked = standingPicks[c.containerId] ?? {};
    return Object.keys(picked).length === c.entrants.length;
  });
  const bracketComplete = [...pickableMatchIds].every((id) => matchPicks[id] !== undefined);
  const canSubmit = groupsComplete && bracketComplete;

  const groupTabs: TournamentContainerTab[] = data.groupContainers.map((container) => {
    const picked = standingPicks[container.containerId] ?? {};
    const usedEntrantIds = new Set(Object.values(picked));
    return {
      id: container.containerId,
      name: container.name,
      content: (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {container.entrants.map((_, index) => {
              const rank = index + 1;
              const selected = picked[rank] ?? null;
              const items: Record<string, string> = { [NO_SELECTION]: t("standingPlaceholder") };
              for (const e of container.entrants) {
                if (usedEntrantIds.has(e.id) && e.id !== selected) continue;
                items[String(e.id)] = e.name;
              }
              return (
                <div key={rank} className="flex items-center gap-3">
                  <span className="w-10 flex-none text-sm font-semibold text-muted-foreground">#{rank}</span>
                  <Select items={items} value={selected !== null ? String(selected) : NO_SELECTION} onValueChange={(v) => v && v !== NO_SELECTION && pickStandingRank(container.containerId, rank, Number(v))}>
                    <SelectTrigger className="flex-1" aria-label={t("standingRankLabel", { rank })}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(items).map(([value, label]) => (
                        <SelectItem key={value} value={value} disabled={value === NO_SELECTION}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ),
    };
  });

  const bracketGroups = groupBracketContainers(data.bracketContainers);
  const matchContainerById = useMemo(() => new Map(data.bracketMatches.map((m) => [m.id, m.containerId])), [data.bracketMatches]);

  return (
    <div className="flex flex-col gap-6">
      {bracketGroups.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-4" style={{ background: "var(--gcs-surface-2)" }}>
          {bracketGroups.length > 1 ? (
            <TournamentContainerTabs
              tabs={bracketGroups.map((g) => {
                const containerIds = new Set(g.containers.map((c) => c.containerId));
                return {
                  id: g.containers[0]!.containerId,
                  name: g.label,
                  content: (
                    <PickemBracketCanvas
                      containers={g.containers.map((c) => ({ id: c.containerId, name: c.name }))}
                      matches={data.bracketMatches.filter((m) => containerIds.has(m.containerId))}
                      edges={data.bracketEdges.filter((e) => containerIds.has(matchContainerById.get(e.fromMatchId) ?? -1) && containerIds.has(matchContainerById.get(e.toMatchId) ?? -1))}
                      virtual={virtual}
                      entrantNames={data.entrantNames}
                      selectedWinners={matchPicksMap}
                      scoringConfig={scoringConfig}
                      disabled={isPending}
                      onPick={pickWinner}
                    />
                  ),
                };
              })}
            />
          ) : (
            <PickemBracketCanvas
              containers={data.bracketContainers.map((c) => ({ id: c.containerId, name: c.name }))}
              matches={data.bracketMatches}
              edges={data.bracketEdges}
              virtual={virtual}
              entrantNames={data.entrantNames}
              selectedWinners={matchPicksMap}
              scoringConfig={scoringConfig}
              disabled={isPending}
              onPick={pickWinner}
            />
          )}
        </div>
      )}

      {groupTabs.length > 0 && <TournamentContainerTabs tabs={groupTabs} />}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground">{t(canSubmit ? "editableHint" : "incompleteHint")}</span>
        <Button onClick={handleSubmit} disabled={isPending || !canSubmit}>
          {isPending ? t("saving") : t(hasExistingPicks ? "updateButton" : "saveButton")}
        </Button>
      </div>
    </div>
  );
}

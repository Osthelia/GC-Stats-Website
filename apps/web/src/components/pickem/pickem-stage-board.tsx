/**
 * GC-Stats - pickem-stage-board
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { TournamentContainerTabs } from "@/components/tournament/tournament-container-tabs";
import { PickemPickForm } from "@/components/pickem/pickem-pick-form";
import type { PickFormData } from "@/lib/pickem/pickem-data";
import type { PhaseScoringConfig } from "@/lib/pickem/scoring";

export type PickemScopeTabInput = { id: number; label: string; config: PhaseScoringConfig; content: ReactNode };

/**
 * Bracket/predictions on the left, leaderboard on the right (same 8/4 split
 * as the public tournament overview's bracket + recent matches). The
 * leaderboard side switches between the global (public, default-scoring)
 * leaderboard and one per pick'em group the viewer belongs to — whichever is
 * selected also drives the points-at-stake/gain figures shown under each
 * bracket match, so both sides of the page always agree on "whose rules".
 */
export function PickemStageBoard({
  stageId,
  pickFormData,
  leftFallback,
  scopeTabs,
}: {
  stageId: number;
  pickFormData: PickFormData | null;
  leftFallback: ReactNode;
  scopeTabs: PickemScopeTabInput[];
}) {
  const t = useTranslations("pickemPage");
  const [scopeId, setScopeId] = useState(scopeTabs[0]?.id ?? 0);
  const activeScope = scopeTabs.find((s) => s.id === scopeId) ?? scopeTabs[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">{pickFormData && activeScope ? <PickemPickForm stageId={stageId} data={pickFormData} scoringConfig={activeScope.config} /> : leftFallback}</div>

      <div className="flex flex-col gap-2 lg:col-span-4">
        <h2 className="text-lg font-semibold">{t("leaderboardTitle")}</h2>
        <TournamentContainerTabs tabs={scopeTabs.map((s) => ({ id: s.id, name: s.label, content: s.content }))} activeId={scopeId} onActiveIdChange={setScopeId} />
      </div>
    </div>
  );
}

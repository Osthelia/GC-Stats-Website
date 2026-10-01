/**
 * GC-Stats - legacy-import-workspace
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/admin/form-field";
import {
  assignLegacyMatchToSlot,
  unassignLegacyMatch,
  addLegacyTargetMatch,
  deleteLegacyTargetMatch,
  moveLegacyTargetMatch,
  connectLegacyEdge,
  disconnectLegacyEdge,
} from "@/actions/admin-legacy-bracket-import";
import { GenerateLegacyShapeForm } from "@/components/admin/legacy-import/generate-legacy-shape-form";
import { LegacyMatchPool } from "@/components/admin/legacy-import/legacy-match-pool";
import { LegacyImportCanvas } from "@/components/admin/legacy-import/legacy-import-canvas";
import type { EditorContainer, EditorMatch, EditorEdge } from "@/lib/admin-bracket-editor-data";

export function LegacyImportWorkspace({
  stageId,
  tournamentId,
  poolMatches,
  targetContainers,
  targetMatches,
  targetEdges,
  entrants,
}: {
  stageId: number;
  tournamentId: number;
  poolMatches: EditorMatch[];
  targetContainers: EditorContainer[];
  targetMatches: EditorMatch[];
  targetEdges: EditorEdge[];
  entrants: { id: number; displayName: string }[];
}) {
  const t = useTranslations("admin.tournaments.legacyImport");
  const tEditor = useTranslations("admin.tournaments.editor");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingMatchId, setPendingMatchId] = useState<number | null>(null);
  const [selectedPoolMatchId, setSelectedPoolMatchId] = useState<number | null>(null);

  const [addContainerId, setAddContainerId] = useState<number | null>(targetContainers[0]?.id ?? null);
  const [addRound, setAddRound] = useState("1");
  const [addBestOf, setAddBestOf] = useState("1");

  function run(matchId: number | null, action: () => Promise<{ ok: true } | { ok: false; error: string }>, successKey: string) {
    setPendingMatchId(matchId);
    startTransition(async () => {
      const result = await action();
      setPendingMatchId(null);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      toast.success(t(successKey));
      router.refresh();
    });
  }

  function handleSelectPoolMatch(matchId: number) {
    setSelectedPoolMatchId((prev) => (prev === matchId ? null : matchId));
  }

  function handleSlotClick(targetMatchId: number) {
    if (selectedPoolMatchId === null) return;
    const sourceMatchId = selectedPoolMatchId;
    setSelectedPoolMatchId(null);
    run(targetMatchId, () => assignLegacyMatchToSlot({ stageId, sourceMatchId, targetMatchId }), "assignSuccess");
  }

  function handleUnassign(matchId: number) {
    run(matchId, () => unassignLegacyMatch({ stageId, matchId }), "unassignSuccess");
  }

  function handleDeleteEmpty(matchId: number) {
    run(matchId, () => deleteLegacyTargetMatch({ stageId, matchId }), "deleteSlotSuccess");
  }

  function handleMoveMatch(matchId: number, round: number, displayOrder: number | null) {
    run(matchId, () => moveLegacyTargetMatch({ stageId, matchId, round, displayOrder }), "moveSuccess");
  }

  function handleConnectEdge(fromMatchId: number, fromResult: "winner" | "loser", toMatchId: number, toSlot: "a" | "b") {
    run(toMatchId, () => connectLegacyEdge({ stageId, fromMatchId, fromResult, toMatchId, toSlot }), "connectSuccess");
  }

  function handleDisconnectEdge(fromMatchId: number, fromResult: "winner" | "loser", toMatchId: number, toSlot: "a" | "b") {
    run(toMatchId, () => disconnectLegacyEdge({ stageId, fromMatchId, fromResult, toMatchId, toSlot }), "disconnectSuccess");
  }

  function handleAddMatch() {
    if (addContainerId === null) return;
    const round = Number(addRound) || 1;
    const bestOf = Number(addBestOf) || 1;
    run(null, () => addLegacyTargetMatch({ stageId, containerId: addContainerId, round, bestOf }), "addMatchSuccess");
  }

  return (
    <div className="flex flex-col gap-4">
      <GenerateLegacyShapeForm stageId={stageId} onGenerated={() => router.refresh()} />

      {targetContainers.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("noTargetYet")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
            <FormField label={tEditor("addMatchLabel")} htmlFor="legacy-import-add-container" className="w-56">
              <Select items={Object.fromEntries(targetContainers.map((c) => [String(c.id), c.name]))} value={addContainerId !== null ? String(addContainerId) : undefined} onValueChange={(v) => v && setAddContainerId(Number(v))}>
                <SelectTrigger id="legacy-import-add-container" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targetContainers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("fieldRound")} htmlFor="legacy-import-add-round" className="w-20">
              <Input id="legacy-import-add-round" type="number" min={1} value={addRound} onChange={(e) => setAddRound(e.target.value)} />
            </FormField>
            <FormField label={tEditor("fieldBestOf")} htmlFor="legacy-import-add-bestof" className="w-20">
              <Input id="legacy-import-add-bestof" type="number" min={1} value={addBestOf} onChange={(e) => setAddBestOf(e.target.value)} />
            </FormField>
            <Button variant="outline" size="sm" onClick={handleAddMatch} disabled={isPending}>
              {tEditor("addMatchButton")}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <LegacyMatchPool matches={poolMatches} entrants={entrants} selectedMatchId={selectedPoolMatchId} isPending={isPending} onSelect={handleSelectPoolMatch} />
            <LegacyImportCanvas
              stageId={stageId}
              tournamentId={tournamentId}
              targetContainers={targetContainers}
              targetMatches={targetMatches}
              targetEdges={targetEdges}
              entrants={entrants}
              pendingMatchId={pendingMatchId}
              selectedPoolMatchId={selectedPoolMatchId}
              onSlotClick={handleSlotClick}
              onDeleteEmpty={handleDeleteEmpty}
              onUnassign={handleUnassign}
              onMoveMatch={handleMoveMatch}
              onConnectEdge={handleConnectEdge}
              onDisconnectEdge={handleDisconnectEdge}
            />
          </div>
        </>
      )}
    </div>
  );
}

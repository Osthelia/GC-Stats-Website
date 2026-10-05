/**
 * GC-Stats - tournament-stages-panel
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StageDialog } from "@/components/admin/stage-dialog";
import { StagePickemDialog } from "@/components/admin/stage-pickem-dialog";
import { ContainerDialog } from "@/components/admin/container-dialog";
import { AssignEntrantsDialog } from "@/components/admin/assign-entrants-dialog";
import { AddGroupMatchDialog } from "@/components/admin/add-group-match-dialog";
import { deleteStage, toggleStageActive } from "@/actions/admin-stages";
import { deleteContainer } from "@/actions/admin-containers";
import { startSwissRound1, resetContainer } from "@/actions/admin-bracket-editor";
import { stageContainerStatusBadgeClass, tournamentActiveBadgeClass } from "@/lib/status-colors";
import type { AdminStageRow, AdminContainerRow, AdminEntrantRow } from "@/lib/admin-tournament-detail";

function ContainerRow({ stage, container, tournamentId, entrants }: { stage: AdminStageRow; container: AdminContainerRow; tournamentId: number; entrants: AdminEntrantRow[] }) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assigning, setAssigning] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [editingContainer, setEditingContainer] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  const isSwiss = container.containerType === "group" && (container.config as { type?: string } | null)?.type === "swiss";
  const swissStarted = container.matchCount > 0;
  const isGroup = container.containerType === "group";

  function openDeleteConfirm() {
    setForceDelete(false);
    setConfirmingDelete(true);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContainer(container.id, stage.id, forceDelete);
      if (!result.ok) {
        toast.error(t(`error.${result.error === "hasPlayedMatches" ? "hasPlayedMatchesForceHint" : result.error}`));
        return;
      }
      setConfirmingDelete(false);
      router.refresh();
      toast.success(t("deleteContainerSuccess"));
    });
  }

  function handleReset() {
    if (!window.confirm(t("resetContainerConfirm", { name: container.name }))) return;
    startTransition(async () => {
      const result = await resetContainer(container.id, stage.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("resetContainerSuccess"));
    });
  }

  function handleStartSwiss() {
    startTransition(async () => {
      const result = await startSwissRound1(container.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("startSwissSuccess"));
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{container.name}</span>
        <span className="text-xs text-muted-foreground">
          {t(container.containerType === "bracket" ? "containerTypeBracket" : "containerTypeGroup")}
          {" · "}
          <Badge className={cn("align-middle", stageContainerStatusBadgeClass(container.status))}>
            {t(`containerStatus.${container.status}`)}
          </Badge>
          {" · "}
          {t("matchCount", { count: container.matchCount })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isSwiss ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setAssigning(true)} disabled={swissStarted}>
              {t("assignEntrantsButton")}
            </Button>
            {!swissStarted && (
              <Button size="sm" onClick={handleStartSwiss} disabled={isPending || container.groupEntryEntrantIds.length < 2}>
                {t("startSwissButton")}
              </Button>
            )}
          </>
        ) : (
          <Button variant="outline" size="sm" render={<Link href={`/admin/tournaments/${tournamentId}/stages/${stage.id}/editor`} />}>
            {t("openEditorButton")}
          </Button>
        )}
        {isGroup && (!isSwiss || swissStarted) && (
          <Button variant="outline" size="sm" onClick={() => setAddingMatch(true)}>
            {t("addMatchButton")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditingContainer(true)}>
          {t("editContainerButton")}
        </Button>
        {container.matchCount > 0 && (
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleReset}>
            {t("resetContainerButton")}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={isPending} onClick={openDeleteConfirm} className="text-destructive hover:text-destructive">
          {t("deleteContainerButton")}
        </Button>
      </div>

      <AssignEntrantsDialog containerId={container.id} entrants={entrants} alreadyAssignedIds={container.groupEntryEntrantIds} open={assigning} onOpenChange={setAssigning} />
      {isGroup && <AddGroupMatchDialog stageId={stage.id} container={container} entrants={entrants} open={addingMatch} onOpenChange={setAddingMatch} />}
      <ContainerDialog stageId={stage.id} container={container} open={editingContainer} onOpenChange={setEditingContainer} />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t("deleteContainerTitle")}
        description={t("deleteContainerConfirm", { name: container.name })}
        confirmLabel={t("deleteContainerButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
      >
        {container.playedMatchCount > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{t("deleteContainerPlayedWarning", { count: container.playedMatchCount })}</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={forceDelete} disabled={isPending} onCheckedChange={(checked) => setForceDelete(checked === true)} />
              {t("deleteContainerForce")}
            </label>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

export function TournamentStagesPanel({ tournamentId, stages, entrants, canManage }: { tournamentId: number; stages: AdminStageRow[]; entrants: AdminEntrantRow[]; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [addingStage, setAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<AdminStageRow | null>(null);
  const [pickemStage, setPickemStage] = useState<AdminStageRow | null>(null);
  const [addingContainerToStage, setAddingContainerToStage] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDeleteStage(stage: AdminStageRow) {
    if (!window.confirm(t("deleteConfirm", { name: stage.name }))) return;
    startTransition(async () => {
      const result = await deleteStage(stage.id, tournamentId);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("deleteSuccess"));
    });
  }

  function handleToggleActive(stage: AdminStageRow) {
    if (!window.confirm(stage.active ? t("deactivateConfirm") : t("activateConfirm"))) return;
    startTransition(async () => {
      const result = await toggleStageActive(stage.id);
      if (!result.ok) return;
      router.refresh();
      toast.success(result.active ? t("activateSuccess") : t("deactivateSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        {canManage && <Button onClick={() => setAddingStage(true)}>{t("addButton")}</Button>}
      </div>

      {stages.length === 0 && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}

      <div className="flex flex-col gap-4">
        {stages.map((stage) => (
          <Card key={stage.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                {stage.name}
                <Badge className={stageContainerStatusBadgeClass(stage.status)}>{t(`stageStatus.${stage.status}`)}</Badge>
                {stage.liquipediaLink && (
                  <a
                    href={stage.liquipediaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("fieldLiquipedia")}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                )}
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-6 px-2 text-xs hover:opacity-80", tournamentActiveBadgeClass(stage.active))}
                    disabled={isPending}
                    onClick={() => handleToggleActive(stage)}
                  >
                    {t(stage.active ? "activateButton" : "deactivateButton")}
                  </Button>
                ) : (
                  <Badge className={tournamentActiveBadgeClass(stage.active)}>{t(stage.active ? "activateButton" : "deactivateButton")}</Badge>
                )}
              </CardTitle>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddingContainerToStage(stage.id)}>
                    {t("addContainerButton")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPickemStage(stage)}>
                    {t(stage.pickemEnabled ? "pickem.buttonEnabled" : "pickem.buttonDisabled")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingStage(stage)}>
                    {t("editButton")}
                  </Button>
                  <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleDeleteStage(stage)} className="text-destructive hover:text-destructive">
                    {t("deleteButton")}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {stage.containers.length === 0 && <p className="text-sm text-muted-foreground">{t("noContainers")}</p>}
              {stage.containers.map((container) => (
                <ContainerRow key={container.id} stage={stage} container={container} tournamentId={tournamentId} entrants={entrants} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <StageDialog tournamentId={tournamentId} stage={null} nextSequenceOrder={stages.length + 1} open={addingStage} onOpenChange={setAddingStage} />
      <StageDialog tournamentId={tournamentId} stage={editingStage} nextSequenceOrder={editingStage?.sequenceOrder ?? 1} open={editingStage !== null} onOpenChange={(open) => !open && setEditingStage(null)} />
      <StagePickemDialog stage={pickemStage} open={pickemStage !== null} onOpenChange={(open) => !open && setPickemStage(null)} />
      {addingContainerToStage !== null && <ContainerDialog stageId={addingContainerToStage} open={addingContainerToStage !== null} onOpenChange={(open) => !open && setAddingContainerToStage(null)} />}
    </div>
  );
}

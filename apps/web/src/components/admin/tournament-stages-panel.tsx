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
import { buildTree, resolveStatuses, subtreeOf, type TreeNode, type TreeRow } from "@osthelia/bracket-engine";
import { ContainerDialog, type SetOption } from "@/components/admin/container-dialog";
import { SetDialog } from "@/components/admin/set-dialog";
import { StageSetRow } from "@/components/admin/stage-set-row";
import { AssignEntrantsDialog } from "@/components/admin/assign-entrants-dialog";
import { AddGroupMatchDialog } from "@/components/admin/add-group-match-dialog";
import { deleteStage, toggleStageActive } from "@/actions/admin-stages";
import { deleteContainer } from "@/actions/admin-containers";
import { DragHandle, DropSlot, StructureDnd, useStructureDnd } from "@/components/admin/structure-dnd";
import { startSwissRound1, resetContainer } from "@/actions/admin-bracket-editor";
import { stageContainerStatusBadgeClass, tournamentActiveBadgeClass } from "@/lib/status-colors";
import type { AdminStageRow, AdminContainerRow, AdminEntrantRow } from "@/lib/admin-tournament-detail";

type ContainerNode = TreeNode<TreeRow<number> & { container: AdminContainerRow }>;

// Containers of a stage as a tree, siblings keep their display order. A stage without sets is a flat list.
function buildContainerTree(containers: AdminContainerRow[]) {
  const rows = containers.map((container) => ({ id: container.id, parentId: container.parentId, isSet: container.containerType === "set", status: container.status as string, container }));
  return { rows, tree: buildTree(rows) };
}

function ContainerRow({ stage, container, sets, tournamentId, entrants }: { stage: AdminStageRow; container: AdminContainerRow; sets: SetOption[]; tournamentId: number; entrants: AdminEntrantRow[] }) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assigning, setAssigning] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [editingContainer, setEditingContainer] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const dnd = useStructureDnd();

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
    <div className={cn("flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-opacity", dnd.activeId === container.id && "opacity-40")}>
      <div className="flex items-center gap-2">
        {dnd.enabled && <DragHandle id={container.id} name={container.name} />}
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
      <ContainerDialog stageId={stage.id} container={container} sets={sets} open={editingContainer} onOpenChange={setEditingContainer} />
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

// Containers and sets of one level, a set renders the level below it. Drop slots sit between siblings.
function ContainerTree({ stage, nodes, parentId, ctx }: { stage: AdminStageRow; nodes: ContainerNode[]; parentId: number | null; ctx: { tournamentId: number; entrants: AdminEntrantRow[]; sets: SetOption[]; statuses: Map<number, string>; rows: ContainerNode["row"][]; draggable: boolean } }) {
  const items = nodes.flatMap((node, index) => {
    const { container } = node.row;
    const slot = ctx.draggable ? [<DropSlot key={`slot-${container.id}`} parentId={parentId} index={index} />] : [];
    if (container.containerType !== "set") {
      return [...slot, <ContainerRow key={container.id} stage={stage} container={container} sets={ctx.sets} tournamentId={ctx.tournamentId} entrants={ctx.entrants} />];
    }
    const inside = subtreeOf(ctx.rows, container.id).filter((r) => !r.isSet);
    return [
      ...slot,
      <StageSetRow
        key={container.id}
        stageId={stage.id}
        set={container}
        sets={ctx.sets}
        status={(ctx.statuses.get(container.id) ?? "pending") as AdminContainerRow["status"]}
        containerCount={inside.length}
        playedMatchCount={inside.reduce((sum, r) => sum + r.container.playedMatchCount, 0)}
      >
        {/* An empty set keeps a slot so a container can be dropped in it */}
        {ctx.draggable && node.children.length === 0 && <DropSlot parentId={container.id} index={0} empty />}
        <ContainerTree stage={stage} nodes={node.children} parentId={container.id} ctx={ctx} />
      </StageSetRow>,
    ];
  });
  if (ctx.draggable && nodes.length > 0) items.push(<DropSlot key="slot-end" parentId={parentId} index={nodes.length} />);
  return items;
}

function StageContainers({ stage, tournamentId, entrants, sets, canManage }: { stage: AdminStageRow; tournamentId: number; entrants: AdminEntrantRow[]; sets: SetOption[]; canManage: boolean }) {
  const { rows, tree } = buildContainerTree(stage.containers);
  return (
    <StructureDnd stageId={stage.id} enabled={canManage} nodes={stage.containers.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))}>
      <div className="flex flex-col">
        <ContainerTree stage={stage} nodes={tree} parentId={null} ctx={{ tournamentId, entrants, sets, statuses: resolveStatuses(rows), rows, draggable: canManage }} />
      </div>
    </StructureDnd>
  );
}

export function TournamentStagesPanel({ tournamentId, stages, entrants, canManage }: { tournamentId: number; stages: AdminStageRow[]; entrants: AdminEntrantRow[]; canManage: boolean }) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [addingStage, setAddingStage] = useState(false);
  const [editingStage, setEditingStage] = useState<AdminStageRow | null>(null);
  const [pickemStage, setPickemStage] = useState<AdminStageRow | null>(null);
  const [addingContainerToStage, setAddingContainerToStage] = useState<number | null>(null);
  const [addingSetToStage, setAddingSetToStage] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sets a container of the stage can be put in, labelled with the sets above them
  const setOptionsOf = (stage: AdminStageRow): SetOption[] =>
    stage.containers.filter((c) => c.containerType === "set").map((c) => ({ id: c.id, label: [c.setPath, c.name].filter(Boolean).join(" - ") }));

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
                  <Button variant="outline" size="sm" onClick={() => setAddingSetToStage(stage.id)}>
                    {t("addSetButton")}
                  </Button>
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
              <StageContainers stage={stage} tournamentId={tournamentId} entrants={entrants} sets={setOptionsOf(stage)} canManage={canManage} />
              {canManage && stage.containers.length > 1 && <p className="text-xs text-muted-foreground">{t("dndHint")}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <StageDialog tournamentId={tournamentId} stage={null} nextSequenceOrder={stages.length + 1} open={addingStage} onOpenChange={setAddingStage} />
      <StageDialog tournamentId={tournamentId} stage={editingStage} nextSequenceOrder={editingStage?.sequenceOrder ?? 1} open={editingStage !== null} onOpenChange={(open) => !open && setEditingStage(null)} />
      <StagePickemDialog stage={pickemStage} open={pickemStage !== null} onOpenChange={(open) => !open && setPickemStage(null)} />
      {addingContainerToStage !== null && (
        <ContainerDialog
          stageId={addingContainerToStage}
          sets={setOptionsOf(stages.find((s) => s.id === addingContainerToStage)!)}
          open={addingContainerToStage !== null}
          onOpenChange={(open) => !open && setAddingContainerToStage(null)}
        />
      )}
      {addingSetToStage !== null && (
        <SetDialog stageId={addingSetToStage} sets={setOptionsOf(stages.find((s) => s.id === addingSetToStage)!)} open={addingSetToStage !== null} onOpenChange={(open) => !open && setAddingSetToStage(null)} />
      )}
    </div>
  );
}

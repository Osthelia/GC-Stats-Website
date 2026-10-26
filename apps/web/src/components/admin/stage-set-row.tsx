/**
 * GC-Stats - stage-set-row
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContainerDialog, type SetOption } from "@/components/admin/container-dialog";
import { SetDialog } from "@/components/admin/set-dialog";
import { DragHandle, useStructureDnd } from "@/components/admin/structure-dnd";
import { deleteContainer } from "@/actions/admin-containers";
import { stageContainerStatusBadgeClass } from "@/lib/status-colors";
import type { AdminContainerRow } from "@/lib/admin-tournament-detail";

/** A set of a stage with the containers nested in it (rendered by the caller as children). */
export function StageSetRow({
  stageId,
  set,
  sets,
  status,
  containerCount,
  playedMatchCount,
  children,
}: {
  stageId: number;
  set: AdminContainerRow;
  sets: SetOption[];
  /** Status aggregated from the containers inside the set. */
  status: AdminContainerRow["status"];
  containerCount: number;
  /** Live or completed matches in the whole set. */
  playedMatchCount: number;
  children: ReactNode;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const dnd = useStructureDnd();
  const [renaming, setRenaming] = useState(false);
  const [addingSet, setAddingSet] = useState(false);
  const [addingContainer, setAddingContainer] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContainer(set.id, stageId, forceDelete);
      if (!result.ok) {
        toast.error(t(`error.${result.error === "hasPlayedMatches" ? "hasPlayedMatchesForceHint" : result.error}`));
        return;
      }
      setConfirmingDelete(false);
      router.refresh();
      toast.success(t("deleteSetSuccess"));
    });
  }

  return (
    <div className={cn("flex flex-col gap-2 rounded-md border bg-muted/20 p-2 transition-opacity", dnd.activeId === set.id && "opacity-40")}>
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          {dnd.enabled && <DragHandle id={set.id} name={set.name} />}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{set.name}</span>
            <span className="text-xs text-muted-foreground">
              {t("containerTypeSet")}
              {" · "}
              <Badge className={cn("align-middle", stageContainerStatusBadgeClass(status))}>{t(`containerStatus.${status}`)}</Badge>
              {" · "}
              {t("setContents", { count: containerCount })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddingContainer(true)}>
            {t("addContainerButton")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddingSet(true)}>
            {t("addSetButton")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
            {t("editContainerButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setForceDelete(false);
              setConfirmingDelete(true);
            }}
            className="text-destructive hover:text-destructive"
          >
            {t("deleteContainerButton")}
          </Button>
        </div>
      </div>

      <div className="ml-4 flex flex-col border-l pl-3">
        {containerCount === 0 && <p className="text-sm text-muted-foreground">{t("setEmpty")}</p>}
        {children}
      </div>

      <SetDialog stageId={stageId} set={set} open={renaming} onOpenChange={setRenaming} />
      <SetDialog stageId={stageId} sets={sets} defaultParentId={set.id} open={addingSet} onOpenChange={setAddingSet} />
      <ContainerDialog stageId={stageId} sets={sets} defaultParentId={set.id} open={addingContainer} onOpenChange={setAddingContainer} />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t("deleteSetTitle")}
        description={t("deleteSetConfirm", { name: set.name })}
        confirmLabel={t("deleteContainerButton")}
        cancelLabel={t("cancel")}
        onConfirm={handleDelete}
        isPending={isPending}
      >
        {playedMatchCount > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{t("deleteContainerPlayedWarning", { count: playedMatchCount })}</p>
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

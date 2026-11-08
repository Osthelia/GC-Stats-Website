/**
 * GC-Stats - group-participants-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setContainerParticipants } from "@/actions/admin-containers";
import type { AdminContainerRow, AdminEntrantRow } from "@/lib/admin-tournament-detail";
import { useGame } from "@/lib/use-game";

/** Teams shown in a Swiss or round robin on the public page, with or without matches. */
export function GroupParticipantsDialog({
  stageId,
  container,
  entrants,
  open,
  onOpenChange,
}: {
  stageId: number;
  container: AdminContainerRow;
  entrants: AdminEntrantRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const game = useGame();
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set(container.groupEntryEntrantIds));
      setError(null);
    }
  }, [open, container.groupEntryEntrantIds]);

  const toggle = (id: number, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await setContainerParticipants(game, container.id, stageId, [...selected]);
      if (!result.ok) {
        setError(t(`error.${result.error}`));
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("participantsSuccess"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("participantsTitle", { name: container.name })}</DialogTitle>
          <DialogDescription>{t("participantsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto py-2">
          {entrants.length === 0 && <p className="text-sm text-muted-foreground">{t("participantsEmpty")}</p>}
          {entrants.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted active:bg-muted/70">
              <Checkbox checked={selected.has(e.id)} onCheckedChange={(checked) => toggle(e.id, checked === true)} />
              {e.displayName}
            </label>
          ))}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">{t("participantsCount", { count: selected.size })}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

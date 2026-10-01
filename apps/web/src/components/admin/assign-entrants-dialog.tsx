/**
 * GC-Stats - assign-entrants-dialog
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
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
import { assignEntrantsToContainer } from "@/actions/admin-containers";
import type { AdminEntrantRow } from "@/lib/admin-tournament-detail";

export function AssignEntrantsDialog({
  containerId,
  entrants,
  alreadyAssignedIds,
  open,
  onOpenChange,
}: {
  containerId: number;
  entrants: AdminEntrantRow[];
  alreadyAssignedIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set(alreadyAssignedIds));
  }, [open, alreadyAssignedIds]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    const newIds = [...selected].filter((id) => !alreadyAssignedIds.includes(id));
    startTransition(async () => {
      const result = await assignEntrantsToContainer(containerId, newIds);
      if (!result.ok) {
        toast.error(t("error.notFound"));
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(t("assignEntrantsSuccess"));
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("assignEntrantsTitle")}</DialogTitle>
          <DialogDescription>{t("assignEntrantsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto py-2">
          {entrants.length === 0 && <p className="text-sm text-muted-foreground">{t("assignEntrantsEmpty")}</p>}
          {entrants.map((entrant) => {
            const locked = alreadyAssignedIds.includes(entrant.id);
            return (
              <label key={entrant.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox checked={selected.has(entrant.id)} disabled={locked} onCheckedChange={() => toggle(entrant.id)} />
                <span className="flex-1 truncate">{entrant.displayName}</span>
                <span className="text-xs text-muted-foreground">{entrant.seed !== null ? `#${entrant.seed}` : ""}</span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
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

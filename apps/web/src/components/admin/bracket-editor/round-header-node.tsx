/**
 * GC-Stats - round-header-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import type { NodeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Button } from "@/components/ui/button";
import { setRoundScheduledAt } from "@/actions/admin-bracket-editor";

export type RoundHeaderNodeData = {
  containerId: number;
  stageId: number;
  round: number;
  /** Common scheduledAt across every match of this (container, round) if they all match, else null (mixed or none). */
  commonScheduledAt: string | null;
};

/**
 * Pinned above each round column — a plain round label plus a bulk date
 * setter, since the same round is very often played at the same
 * date/time (2026-09-11 user request: setting 30+ matches one by one
 * doesn't scale on a large Swiss/bracket). Not draggable/selectable
 * (wired via nodesDraggable/elementsSelectable being false for this node
 * type at the ReactFlow level), always interactive regardless of the
 * canvas's structural read-only state — a date is administrative, not
 * structural (same precedent as the single-match edit page, cf.
 * actions/admin-matches.ts::updateMatchDetails).
 */
export function RoundHeaderNode({ data }: NodeProps & { data: RoundHeaderNodeData }) {
  const t = useTranslations("admin.tournaments.editor");
  const router = useRouter();
  const [value, setValue] = useState<string | null>(data.commonScheduledAt);
  const [isPending, startTransition] = useTransition();

  function apply() {
    startTransition(async () => {
      const result = await setRoundScheduledAt(data.containerId, data.stageId, data.round, value);
      if (!result.ok) {
        toast.error(t(`bulkDateError.${result.error}`));
        return;
      }
      if (result.count === 0) {
        toast.error(t("bulkDateNoMatches"));
        return;
      }
      toast.success(t("bulkDateSuccess", { count: result.count }));
      router.refresh();
    });
  }

  return (
    <div className="nodrag nopan flex h-[70px] w-56 flex-col justify-center gap-1.5 rounded-lg border border-dashed bg-muted/30 p-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarIcon className="size-3.5" />
        {t("roundLabel", { round: data.round })}
      </div>
      <div className="flex items-center gap-1.5">
        <DateTimeInput value={value} onChange={setValue} showTimezone={false} className="h-7 flex-1 text-xs" />
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={isPending} onClick={apply}>
          {t("bulkDateApply")}
        </Button>
      </div>
    </div>
  );
}

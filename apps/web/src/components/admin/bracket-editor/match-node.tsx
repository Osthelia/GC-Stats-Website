/**
 * GC-Stats - match-node
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useLocale, useTranslations } from "next-intl";
import { SquarePenIcon, CalendarClockIcon, Trash2Icon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EditorSlotSource } from "@/actions/admin-bracket-editor";

export type MatchNodeData = {
  containerId: number;
  containerName: string;
  round: number;
  label: string | null;
  bestOf: number;
  invalid: boolean;
  slotA: EditorSlotSource;
  slotB: EditorSlotSource;
  slotALabel: string;
  slotBLabel: string;
  entrantOptions: { id: number; displayName: string; seed: number | null }[];
  onSetSlot: (slot: "a" | "b", source: EditorSlotSource) => void;
  onDelete: () => void;
  readOnly: boolean;
  /** Edit-match link (null for a not-yet-saved node created client-side in the editor — it has no matchId to link to until saved). */
  matchHref: string | null;
  scheduledAt: string | null;
};

const ENTRANT_UNSET = "unset";
const ENTRANT_BYE = "bye";

function SlotRow({ slot, source, label, entrantOptions, onSetSlot, readOnly }: { slot: "a" | "b"; source: EditorSlotSource; label: string; entrantOptions: MatchNodeData["entrantOptions"]; onSetSlot: MatchNodeData["onSetSlot"]; readOnly: boolean }) {
  const t = useTranslations("admin.tournaments.editor");

  if (source.type === "edge") {
    return <div className="truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{label}</div>;
  }

  if (readOnly) {
    return (
      <div className="truncate rounded bg-muted px-2 py-1 text-xs">
        {source.type === "bye" ? t("byeLabel") : source.type === "entrant" ? label : t("tbdLabel")}
      </div>
    );
  }

  const value = source.type === "entrant" ? String(source.entrantId) : source.type === "bye" ? ENTRANT_BYE : ENTRANT_UNSET;
  const items: Record<string, string> = { [ENTRANT_UNSET]: t("tbdLabel"), [ENTRANT_BYE]: t("byeLabel"), ...Object.fromEntries(entrantOptions.map((e) => [String(e.id), e.displayName])) };

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => {
        if (!v) return;
        if (v === ENTRANT_UNSET) onSetSlot(slot, { type: "unset" });
        else if (v === ENTRANT_BYE) onSetSlot(slot, { type: "bye" });
        else onSetSlot(slot, { type: "entrant", entrantId: Number(v) });
      }}
    >
      <SelectTrigger className="nodrag nopan h-7 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ENTRANT_UNSET}>{t("tbdLabel")}</SelectItem>
        <SelectItem value={ENTRANT_BYE}>{t("byeLabel")}</SelectItem>
        {entrantOptions.map((e) => (
          <SelectItem key={e.id} value={String(e.id)}>
            {e.seed !== null ? `#${e.seed} ` : ""}
            {e.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MatchNode({ data }: NodeProps & { data: MatchNodeData }) {
  const t = useTranslations("admin.tournaments.editor");
  const locale = useLocale();
  const scheduledLabel = data.scheduledAt
    ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data.scheduledAt))
    : null;

  return (
    <div className={cn("w-56 rounded-lg border bg-card p-2 shadow-sm", data.invalid && "border-destructive ring-2 ring-destructive/40")}>
      <Handle type="target" position={Position.Left} id="a" className="!size-3" style={{ top: "38%" }} />
      <Handle type="target" position={Position.Left} id="b" className="!size-3" style={{ top: "72%" }} />

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {data.containerName} · {t("roundLabel", { round: data.round })}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {data.invalid && <span className="text-[10px] font-semibold text-destructive">{t("invalidBadge")}</span>}
          {data.matchHref && (
            <Link href={data.matchHref} className="nodrag text-muted-foreground hover:text-foreground" title={t("editMatchLink")}>
              <SquarePenIcon className="size-3.5" />
            </Link>
          )}
          {!data.readOnly && (
            <button
              type="button"
              className="nodrag cursor-pointer text-muted-foreground hover:text-destructive"
              title={t("deleteMatchButton")}
              onClick={data.onDelete}
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {data.label && <div className="mb-1 truncate text-xs font-semibold">{data.label}</div>}

      <div className="flex flex-col gap-1">
        <SlotRow slot="a" source={data.slotA} label={data.slotALabel} entrantOptions={data.entrantOptions} onSetSlot={data.onSetSlot} readOnly={data.readOnly} />
        <SlotRow slot="b" source={data.slotB} label={data.slotBLabel} entrantOptions={data.entrantOptions} onSetSlot={data.onSetSlot} readOnly={data.readOnly} />
      </div>

      {scheduledLabel && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarClockIcon className="size-3" />
          {scheduledLabel}
        </div>
      )}

      <Handle type="source" position={Position.Right} id="winner" style={{ top: "38%" }} className="!size-3 !bg-emerald-500" />
      <Handle type="source" position={Position.Right} id="loser" style={{ top: "72%" }} className="!size-3 !bg-rose-500" />
    </div>
  );
}

/**
 * GC-Stats - stage-status-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGE_STATUSES, type StageStatus } from "@/lib/stage-status";

/** Status picker for both stages and containers. */
export function StageStatusSelect({ id, value, onChange, invalid }: { id: string; value: StageStatus; onChange: (value: StageStatus) => void; invalid?: boolean }) {
  const t = useTranslations("admin.tournaments.stages");
  const items = Object.fromEntries(STAGE_STATUSES.map((s) => [s, t(`stageStatus.${s}`)]));

  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v as StageStatus)}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGE_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {items[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * GC-Stats - entrant-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminEntrantRow } from "@/lib/admin-tournament-detail";

const TBD = "tbd";

/** Entrant picker of a tournament, null meaning TBD. */
export function EntrantSelect({
  id,
  value,
  entrants,
  onChange,
  invalid,
  className,
}: {
  id?: string;
  value: number | null;
  entrants: AdminEntrantRow[];
  onChange: (entrantId: number | null) => void;
  invalid?: boolean;
  className?: string;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const items: Record<string, string> = { [TBD]: t("addMatchEntrantTbd"), ...Object.fromEntries(entrants.map((e) => [String(e.id), e.displayName])) };

  return (
    <Select items={items} value={value === null ? TBD : String(value)} onValueChange={(v) => v && onChange(v === TBD ? null : Number(v))}>
      <SelectTrigger id={id} className={className ?? "w-full"} aria-invalid={invalid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TBD}>{t("addMatchEntrantTbd")}</SelectItem>
        {entrants.map((e) => (
          <SelectItem key={e.id} value={String(e.id)}>
            {e.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

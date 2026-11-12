/**
 * GC-Stats - entrant-select
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { SearchablePicker } from "@/components/admin/searchable-picker";
import type { AdminEntrantRow } from "@/lib/admin-tournament-detail";

/** Entrant picker of a tournament that can be searched by typing, null meaning TBD. */
export function EntrantSelect({
  id,
  value,
  entrants,
  onChange,
  invalid,
}: {
  id?: string;
  value: number | null;
  entrants: AdminEntrantRow[];
  onChange: (entrantId: number | null) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("admin.tournaments.stages");
  const tEntrants = useTranslations("admin.tournaments.entrants");

  return (
    <SearchablePicker
      id={id}
      value={value === null ? null : String(value)}
      options={entrants.map((e) => ({ id: String(e.id), label: e.displayName }))}
      onChange={(entrantId) => onChange(entrantId === null ? null : Number(entrantId))}
      placeholder={t("addMatchEntrantTbd")}
      noneLabel={t("addMatchEntrantTbd")}
      searchPlaceholder={tEntrants("fieldTeamSearchPlaceholder")}
      noResultsLabel={tEntrants("fieldTeamNoResults")}
      invalid={invalid}
    />
  );
}

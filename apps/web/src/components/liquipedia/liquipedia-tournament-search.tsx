/**
 * GC-Stats - liquipedia-tournament-search
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { PublicEntityPicker } from "@/components/forms/public-entity-picker";
import { slugify } from "@/lib/entity-id";

/** Tournament search that opens the Liquipedia page of the chosen tournament. */
export function LiquipediaTournamentSearch() {
  const t = useTranslations("liquipediaHub");
  const router = useRouter();
  const [value, setValue] = useState<{ id: number; label: string } | null>(null);
  const [navigating, setNavigating] = useState(false);

  function handleChange(tournament: { id: number; label: string } | null) {
    setValue(tournament);
    if (!tournament) return;
    setNavigating(true);
    router.push(`/tournaments/${tournament.id}/${slugify(tournament.label, "tournament")}/liquipedia`);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <PublicEntityPicker
          type="tournament"
          value={value}
          onChange={handleChange}
          placeholder={t("tournamentPlaceholder")}
          searchPlaceholder={t("tournamentSearchPlaceholder")}
          noResultsLabel={t("tournamentNoResults")}
        />
      </div>
      {navigating && <Loader2 className="size-4 shrink-0 animate-spin text-neutral-500" />}
    </div>
  );
}

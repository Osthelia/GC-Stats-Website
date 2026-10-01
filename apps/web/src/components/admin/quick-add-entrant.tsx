/**
 * GC-Stats - quick-add-entrant
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TeamPicker } from "@/components/admin/team-picker";
import { quickAttachTeamEntrant, quickCreateTeamEntrant } from "@/actions/admin-tournament-entrants";

/**
 * V1-parity quick add (see tournament-team-picker.blade.php): pick a team
 * from the search box and it's attached right away, no dialog, no redirect.
 * A plain name+button fallback creates a brand-new team and attaches it in
 * the same step, for a team that isn't in the database yet.
 */
export function QuickAddEntrant({ tournamentId }: { tournamentId: number }) {
  const t = useTranslations("admin.tournaments.entrants");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newTeamName, setNewTeamName] = useState("");

  function handlePick(team: { id: number; name: string } | null) {
    if (!team) return;
    startTransition(async () => {
      const result = await quickAttachTeamEntrant(tournamentId, team.id);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      router.refresh();
      toast.success(t("quickAddSuccess"));
    });
  }

  function handleCreate() {
    const name = newTeamName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await quickCreateTeamEntrant(tournamentId, name);
      if (!result.ok) {
        toast.error(t(`error.${result.error}`));
        return;
      }
      setNewTeamName("");
      router.refresh();
      toast.success(t("quickAddSuccess"));
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex-1">
        <TeamPicker
          value={null}
          onChange={handlePick}
          placeholder={t("quickAddTeamPlaceholder")}
          searchPlaceholder={t("quickAddTeamSearchPlaceholder")}
          noResultsLabel={t("quickAddTeamNoResults")}
        />
      </div>
      <div className="flex flex-1 gap-2">
        <Input
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder={t("quickAddCreatePlaceholder")}
          disabled={isPending}
        />
        <Button type="button" variant="outline" onClick={handleCreate} disabled={isPending || !newTeamName.trim()}>
          {t("quickAddCreateButton")}
        </Button>
      </div>
    </div>
  );
}
